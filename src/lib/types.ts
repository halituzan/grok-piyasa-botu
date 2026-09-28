export type Mode = 'paper' | 'live';

export type TokenGroup = 'kopek' | 'kedi' | 'hayvan' | 'absurt' | 'politik';

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  group: TokenGroup;
  /** false for user-added tokens */
  builtin: boolean;
}

export interface MarketRow {
  mint: string;
  symbol: string;
  priceUsd: number;
  change: { m5: number; h1: number; h6: number; h24: number };
  liquidityUsd: number;
  volume24Usd: number;
  pairAddress?: string;
  updatedAt: number;
}

export type ActionKind = 'AL' | 'SAT' | 'ROTASYON' | 'TUT' | 'BEKLE';

export interface ScoredRow extends MarketRow {
  group: TokenGroup;
  momentum: number;
  relScore: number;
  rank: number;
  action: ActionKind;
  rotateTargetMint?: string;
  rotateTargetSymbol?: string;
  reason: string;
}

export interface Position {
  mint: string;
  symbol: string;
  qty: number;
  avgCostUsd: number;
}

export type TradeKind = 'buy' | 'sell' | 'rotate';

export interface Trade {
  id: string;
  ts: number;
  mode: Mode;
  kind: TradeKind;
  symbol: string;
  toSymbol?: string;
  qty: number;
  priceUsd: number;
  usdValue: number;
  feeUsd: number;
  slippageBps: number;
  realizedPnlUsd?: number;
  signature?: string;
  note?: string;
}

export interface PaperState {
  version: 1;
  startUsd: number;
  cashUsd: number;
  positions: Record<string, Position>;
  trades: Trade[];
  daily: { date: string; realizedUsd: number };
}

export interface RiskSettings {
  /** Max share of equity in a single coin, percent (1-100). */
  maxPctPerCoin: number;
  /** Daily realized loss limit as percent of equity (1-100). New buys blocked past this. */
  dailyLossLimitPct: number;
  /** Slippage tolerance in basis points. */
  slippageBps: number;
  /** Paper starting balance in USD. */
  startUsd: number;
}

export const DEFAULT_RISK: RiskSettings = {
  maxPctPerCoin: 25,
  dailyLossLimitPct: 10,
  slippageBps: 100,
  startUsd: 50,
};
