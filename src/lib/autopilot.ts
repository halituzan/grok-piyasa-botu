/**
 * AI Otopilot karar motoru — hem istemci (fallback) hem sunucu (LLM doğrulama)
 * tarafından kullanılır. Karar her zaman ücret/maliyet farkındalığıyla verilir:
 * beklenen kenar (edge), gidiş-dönüş maliyetini (ağ ücreti + slippage payı)
 * yeterince aşmıyorsa işlem yapılmaz.
 */

export interface AiSnapshotRow {
  mint: string;
  symbol: string;
  group: string;
  priceUsd: number;
  m5: number;
  h1: number;
  h6: number;
  h24: number;
  relScore: number;
  rank: number;
  liquidityUsd: number;
}

export interface AiSnapshotPosition {
  mint: string;
  symbol: string;
  qty: number;
  avgCostUsd: number;
  valueUsd: number;
  pnlPct: number;
  relScore: number;
}

export interface AiSnapshot {
  rows: AiSnapshotRow[];
  positions: AiSnapshotPosition[];
  cashUsd: number;
  equityUsd: number;
  startUsd: number;
  dailyRealizedUsd: number;
  risk: { maxPctPerCoin: number; dailyLossLimitPct: number; slippageBps: number };
  limits: { floorUsd: number; ceilingUsd: number };
  /** Sabit ağ ücreti tahmini, USD (işlem başına). */
  feePerTradeUsd: number;
  /** Kenar / maliyet oranı eşiği (ör. 1.2 = maliyetin %120'si kadar kenar gerekir). */
  minEdgeRatio: number;
}

export type AiAction = 'buy' | 'sell' | 'rotate' | 'hold';

export interface AiDecision {
  action: AiAction;
  mint?: string;
  toMint?: string;
  usd?: number;
  reason: string;
}

export interface AiResponse {
  decision: AiDecision;
  source: 'llm' | 'heuristic';
  model?: string;
}

/** 1 z-skoru farkının kısa vadede yaklaşık % kaç kenar ürettiği varsayımı. */
const EDGE_PER_Z_PCT = 1.5;
const BUY_Z = 0.75;
const ROTATE_SOURCE_Z = -0.5;
const ROTATE_TARGET_Z = 0.4;
const SELL_Z = -1.2;
const MIN_TRADE_USD = 2;

/** Tek bacak işlem maliyeti, yüzde olarak (ücret + slippage payı). */
export function legCostPct(sizeUsd: number, slippageBps: number, feeUsd: number): number {
  if (sizeUsd <= 0) return Infinity;
  return (feeUsd / sizeUsd) * 100 + (slippageBps / 10_000 / 2) * 100;
}

export function decideHeuristic(s: AiSnapshot): AiDecision {
  const { rows, positions, cashUsd, equityUsd, risk, feePerTradeUsd, minEdgeRatio } = s;
  if (rows.length === 0) return { action: 'hold', reason: 'Piyasa verisi yok.' };

  const sorted = [...rows].sort((a, b) => b.relScore - a.relScore);
  const best = sorted[0];
  const heldMints = new Set(positions.map((p) => p.mint));

  // 1) Rotasyon: en zayıf pozisyondan en güçlü tokena — kenar maliyeti aşarsa.
  const weakest = [...positions].sort((a, b) => a.relScore - b.relScore)[0];
  if (weakest && weakest.relScore <= ROTATE_SOURCE_Z) {
    const target = sorted.find((r) => !heldMints.has(r.mint) && r.relScore >= ROTATE_TARGET_Z);
    if (target) {
      const size = weakest.valueUsd;
      const edgePct = (target.relScore - weakest.relScore) * EDGE_PER_Z_PCT;
      const costPct = 2 * legCostPct(size, risk.slippageBps, feePerTradeUsd);
      if (size >= MIN_TRADE_USD && edgePct >= costPct * minEdgeRatio) {
        return {
          action: 'rotate',
          mint: weakest.mint,
          toMint: target.mint,
          usd: size,
          reason: `${weakest.symbol} zayıf (z=${weakest.relScore.toFixed(2)}), ${target.symbol} güçlü (z=${target.relScore.toFixed(2)}). Beklenen kenar %${edgePct.toFixed(2)} > maliyet %${costPct.toFixed(2)}.`,
        };
      }
    }
    // 2) Koruyucu satış: çok zayıf ve hedef yok.
    if (weakest.relScore <= SELL_Z && weakest.valueUsd >= MIN_TRADE_USD) {
      const costPct = legCostPct(weakest.valueUsd, risk.slippageBps, feePerTradeUsd);
      const edgePct = Math.abs(weakest.relScore) * EDGE_PER_Z_PCT;
      if (edgePct >= costPct * minEdgeRatio) {
        return {
          action: 'sell',
          mint: weakest.mint,
          usd: weakest.valueUsd,
          reason: `${weakest.symbol} çok zayıf (z=${weakest.relScore.toFixed(2)}) ve güçlü hedef yok — nakde dön (maliyet %${costPct.toFixed(2)}).`,
        };
      }
    }
  }

  // 3) Alım: nakit varsa ve lider yeterince güçlüyse.
  if (best.relScore >= BUY_Z) {
    const heldValue = positions.find((p) => p.mint === best.mint)?.valueUsd ?? 0;
    const budget = (risk.maxPctPerCoin / 100) * equityUsd - heldValue;
    const size = Math.min(cashUsd, budget);
    if (size >= MIN_TRADE_USD) {
      const edgePct = best.relScore * EDGE_PER_Z_PCT;
      const costPct = legCostPct(size, risk.slippageBps, feePerTradeUsd);
      if (edgePct >= costPct * minEdgeRatio) {
        return {
          action: 'buy',
          mint: best.mint,
          usd: size,
          reason: `${best.symbol} sepetin lideri (z=${best.relScore.toFixed(2)}). Beklenen kenar %${edgePct.toFixed(2)} > maliyet %${costPct.toFixed(2)}.`,
        };
      }
    }
  }

  return {
    action: 'hold',
    reason: `Ücret sonrası yeterli kenar yok (lider: ${best.symbol}, z=${best.relScore.toFixed(2)}). Bekleniyor.`,
  };
}

/**
 * LLM'den (veya herhangi bir kaynaktan) gelen kararı risk sınırlarına göre
 * doğrular ve kırpar. Geçersizse null döner (çağıran sezgisele düşer).
 */
export function sanitizeDecision(d: unknown, s: AiSnapshot): AiDecision | null {
  if (!d || typeof d !== 'object') return null;
  const dec = d as Partial<AiDecision>;
  const reason = typeof dec.reason === 'string' ? dec.reason.slice(0, 300) : 'AI kararı';
  const rowByMint = new Map(s.rows.map((r) => [r.mint, r]));
  const posByMint = new Map(s.positions.map((p) => [p.mint, p]));

  if (dec.action === 'hold') return { action: 'hold', reason };

  if (dec.action === 'buy') {
    if (!dec.mint || !rowByMint.has(dec.mint)) return null;
    const heldValue = posByMint.get(dec.mint)?.valueUsd ?? 0;
    const budget = (s.risk.maxPctPerCoin / 100) * s.equityUsd - heldValue;
    const usd = Math.min(Number(dec.usd) || 0, s.cashUsd, budget);
    if (!(usd >= MIN_TRADE_USD)) return null;
    return { action: 'buy', mint: dec.mint, usd, reason };
  }

  if (dec.action === 'sell' || dec.action === 'rotate') {
    if (!dec.mint) return null;
    const pos = posByMint.get(dec.mint);
    if (!pos) return null;
    const usd = Math.min(Number(dec.usd) || pos.valueUsd, pos.valueUsd);
    if (!(usd >= MIN_TRADE_USD)) return null;
    if (dec.action === 'sell') return { action: 'sell', mint: dec.mint, usd, reason };
    if (!dec.toMint || dec.toMint === dec.mint || !rowByMint.has(dec.toMint)) return null;
    return { action: 'rotate', mint: dec.mint, toMint: dec.toMint, usd, reason };
  }

  return null;
}

export interface AutopilotSettings {
  enabled: boolean;
  /** Alt limit: toplam değer bu USD seviyesine düşerse her şey satılır ve otopilot durur. */
  floorUsd: number;
  /** Üst limit: toplam değer bu seviyeye ulaşırsa kâr realize edilir ve otopilot durur. */
  ceilingUsd: number;
  intervalSec: number;
  minEdgeRatio: number;
}

export const DEFAULT_AUTOPILOT: AutopilotSettings = {
  enabled: false,
  floorUsd: 40,
  ceilingUsd: 100,
  intervalSec: 45,
  minEdgeRatio: 1.2,
};

export interface AutopilotLogEntry {
  id: string;
  ts: number;
  decision: AiDecision;
  source: 'llm' | 'heuristic' | 'limit';
  executed: boolean;
  error?: string;
  equityUsd: number;
}
