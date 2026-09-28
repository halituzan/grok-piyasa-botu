import { SOL_MINT } from './tokens';
import type { MarketRow } from './types';

const DEXSCREENER_BASE = 'https://api.dexscreener.com';

interface DsPair {
  chainId: string;
  pairAddress: string;
  baseToken: { address: string; symbol: string; name: string };
  quoteToken: { address: string; symbol: string };
  priceUsd?: string;
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
}

export class RateLimitError extends Error {
  constructor() {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
  }
}

/**
 * Fetch market data for a list of mints from DexScreener.
 * For each mint, the pair with the highest USD liquidity is used.
 * DexScreener allows up to 30 addresses per request.
 */
export async function fetchMarketRows(mints: string[]): Promise<Map<string, MarketRow>> {
  const result = new Map<string, MarketRow>();
  const chunks: string[][] = [];
  for (let i = 0; i < mints.length; i += 30) chunks.push(mints.slice(i, i + 30));

  for (const chunk of chunks) {
    const url = `${DEXSCREENER_BASE}/tokens/v1/solana/${chunk.join(',')}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (res.status === 429) throw new RateLimitError();
    if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`);
    const pairs = (await res.json()) as DsPair[];
    const now = Date.now();

    for (const mint of chunk) {
      const candidates = pairs.filter(
        (p) => p.chainId === 'solana' && p.baseToken?.address === mint && p.priceUsd
      );
      if (candidates.length === 0) continue;
      const best = candidates.reduce((a, b) =>
        (b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a
      );
      result.set(mint, {
        mint,
        symbol: best.baseToken.symbol,
        priceUsd: Number(best.priceUsd),
        change: {
          m5: best.priceChange?.m5 ?? 0,
          h1: best.priceChange?.h1 ?? 0,
          h6: best.priceChange?.h6 ?? 0,
          h24: best.priceChange?.h24 ?? 0,
        },
        liquidityUsd: best.liquidity?.usd ?? 0,
        volume24Usd: best.volume?.h24 ?? 0,
        pairAddress: best.pairAddress,
        updatedAt: now,
      });
    }
  }
  return result;
}

/** Fetch the SOL price in USD (uses the wrapped SOL market). */
export async function fetchSolPrice(): Promise<number | null> {
  try {
    const rows = await fetchMarketRows([SOL_MINT]);
    return rows.get(SOL_MINT)?.priceUsd ?? null;
  } catch {
    return null;
  }
}

/** Look up token metadata (symbol, name) for an arbitrary mint. */
export async function lookupTokenMeta(
  mint: string
): Promise<{ symbol: string; name: string } | null> {
  try {
    const url = `${DEXSCREENER_BASE}/tokens/v1/solana/${mint}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const pairs = (await res.json()) as DsPair[];
    const p = pairs.find((x) => x.baseToken?.address === mint);
    if (!p) return null;
    return { symbol: p.baseToken.symbol, name: p.baseToken.name };
  } catch {
    return null;
  }
}
