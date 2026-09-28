import { Connection, VersionedTransaction } from '@solana/web3.js';

const BASE =
  process.env.NEXT_PUBLIC_JUPITER_BASE_URL?.replace(/\/$/, '') || 'https://lite-api.jup.ag';
const API_KEY = process.env.NEXT_PUBLIC_JUPITER_API_KEY || '';

function headers(): HeadersInit {
  const h: Record<string, string> = { accept: 'application/json' };
  if (API_KEY) h['x-api-key'] = API_KEY;
  return h;
}

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: Array<{
    swapInfo: {
      label?: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  [key: string]: unknown;
}

/**
 * Get a swap quote from Jupiter.
 * @param amount raw amount of the input mint in its smallest unit
 */
export async function getQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: bigint;
  slippageBps: number;
}): Promise<JupiterQuote> {
  const q = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount.toString(),
    slippageBps: String(params.slippageBps),
    restrictIntermediateTokens: 'true',
  });
  const res = await fetch(`${BASE}/swap/v1/quote?${q}`, { headers: headers() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Jupiter quote HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as JupiterQuote;
}

/**
 * Build an unsigned swap transaction from a quote. The transaction is signed
 * only inside the user's wallet — this app never touches private keys.
 */
export async function buildSwapTransaction(
  quote: JupiterQuote,
  userPublicKey: string
): Promise<VersionedTransaction> {
  const res = await fetch(`${BASE}/swap/v1/swap`, {
    method: 'POST',
    headers: { ...headers(), 'content-type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: { maxLamports: 2_000_000, priorityLevel: 'high' },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Jupiter swap HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { swapTransaction: string };
  const raw = Buffer.from(data.swapTransaction, 'base64');
  return VersionedTransaction.deserialize(raw);
}

/** Estimated network fee for a Jupiter swap, in SOL (base fee + priority, rough). */
export const EST_NETWORK_FEE_SOL = 0.0006;

export interface FeeEstimate {
  priceImpactPct: number;
  networkFeeSol: number;
  networkFeeUsd: number | null;
  outAmountUi: number;
  minOutAmountUi: number;
}

export function summarizeQuote(
  quote: JupiterQuote,
  outDecimals: number,
  solPriceUsd: number | null
): FeeEstimate {
  const outAmountUi = Number(quote.outAmount) / 10 ** outDecimals;
  const minOutAmountUi = Number(quote.otherAmountThreshold) / 10 ** outDecimals;
  return {
    priceImpactPct: Number(quote.priceImpactPct) * 100,
    networkFeeSol: EST_NETWORK_FEE_SOL,
    networkFeeUsd: solPriceUsd ? EST_NETWORK_FEE_SOL * solPriceUsd : null,
    outAmountUi,
    minOutAmountUi,
  };
}

export async function sendAndConfirm(
  connection: Connection,
  signed: VersionedTransaction
): Promise<string> {
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  return sig;
}

export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}
