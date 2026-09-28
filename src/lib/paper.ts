import { todayKey } from './format';
import type { PaperState, Position, RiskSettings, Trade, TradeKind } from './types';

/** Estimated per-swap network cost applied to paper fills, USD. */
export const PAPER_FEE_USD = 0.03;

export function initialPaperState(startUsd: number): PaperState {
  return {
    version: 1,
    startUsd,
    cashUsd: startUsd,
    positions: {},
    trades: [],
    daily: { date: todayKey(), realizedUsd: 0 },
  };
}

export function equityUsd(state: PaperState, prices: Map<string, number>): number {
  let total = state.cashUsd;
  for (const pos of Object.values(state.positions)) {
    const p = prices.get(pos.mint);
    if (p) total += pos.qty * p;
  }
  return total;
}

export function unrealizedPnlUsd(state: PaperState, prices: Map<string, number>): number {
  let pnl = 0;
  for (const pos of Object.values(state.positions)) {
    const p = prices.get(pos.mint);
    if (p) pnl += pos.qty * (p - pos.avgCostUsd);
  }
  return pnl;
}

function rollDaily(state: PaperState): PaperState {
  const today = todayKey();
  if (state.daily.date === today) return state;
  return { ...state, daily: { date: today, realizedUsd: 0 } };
}

export interface TradeParams {
  kind: TradeKind;
  mint: string;
  symbol: string;
  /** For rotate: target token. */
  toMint?: string;
  toSymbol?: string;
  /** Trade size in USD (buy: cash spent; sell/rotate: position value sold). */
  usd: number;
  prices: Map<string, number>;
  risk: RiskSettings;
}

export interface TradeResult {
  state: PaperState;
  trade?: Trade;
  error?: string;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function checkDailyLoss(state: PaperState, risk: RiskSettings, equity: number): string | null {
  const limitUsd = (risk.dailyLossLimitPct / 100) * Math.max(equity, state.startUsd);
  if (state.daily.realizedUsd <= -limitUsd) {
    return `Günlük zarar limiti aşıldı (${risk.dailyLossLimitPct}%). Bugün yeni alım yapılamaz.`;
  }
  return null;
}

/**
 * Execute a simulated trade. Fills use the live quote price with a haircut of
 * half the configured slippage tolerance, plus a fixed network-fee estimate.
 */
export function executePaperTrade(state0: PaperState, params: TradeParams): TradeResult {
  const state = rollDaily(state0);
  const { kind, mint, symbol, usd, prices, risk } = params;
  const price = prices.get(mint);
  if (!price || price <= 0) return { state, error: 'Fiyat verisi yok.' };
  if (usd <= 0) return { state, error: 'Geçersiz tutar.' };

  const slip = risk.slippageBps / 10_000 / 2;
  const equity = equityUsd(state, prices);
  const now = Date.now();

  if (kind === 'buy') {
    const dailyErr = checkDailyLoss(state, risk, equity);
    if (dailyErr) return { state, error: dailyErr };
    if (usd > state.cashUsd) return { state, error: 'Yetersiz nakit.' };

    const existing = state.positions[mint];
    const existingValue = existing ? existing.qty * price : 0;
    const maxUsd = (risk.maxPctPerCoin / 100) * equity;
    if (existingValue + usd > maxUsd + 1e-9) {
      return {
        state,
        error: `Coin başına maksimum %${risk.maxPctPerCoin} sınırı aşılıyor (limit ~${maxUsd.toFixed(2)} USD).`,
      };
    }

    const fillPrice = price * (1 + slip);
    const usdAfterFee = usd - PAPER_FEE_USD;
    if (usdAfterFee <= 0) return { state, error: 'Tutar ücretten küçük.' };
    const qty = usdAfterFee / fillPrice;

    const newPos: Position = existing
      ? {
          ...existing,
          qty: existing.qty + qty,
          avgCostUsd:
            (existing.qty * existing.avgCostUsd + qty * fillPrice) / (existing.qty + qty),
        }
      : { mint, symbol, qty, avgCostUsd: fillPrice };

    const trade: Trade = {
      id: makeId(),
      ts: now,
      mode: 'paper',
      kind: 'buy',
      symbol,
      qty,
      priceUsd: fillPrice,
      usdValue: usd,
      feeUsd: PAPER_FEE_USD,
      slippageBps: risk.slippageBps,
    };

    return {
      state: {
        ...state,
        cashUsd: state.cashUsd - usd,
        positions: { ...state.positions, [mint]: newPos },
        trades: [trade, ...state.trades],
      },
      trade,
    };
  }

  // sell or rotate: sell `usd` worth of the position first
  const pos = state.positions[mint];
  if (!pos || pos.qty <= 0) return { state, error: 'Pozisyon yok.' };
  const posValue = pos.qty * price;
  const sellUsd = Math.min(usd, posValue);
  const sellQty = Math.min(pos.qty, sellUsd / price);
  const fillPrice = price * (1 - slip);
  const proceeds = sellQty * fillPrice - PAPER_FEE_USD;
  if (proceeds <= 0) return { state, error: 'Satış tutarı ücretten küçük.' };
  const realized = sellQty * (fillPrice - pos.avgCostUsd) - PAPER_FEE_USD;

  const remainingQty = pos.qty - sellQty;
  const positions = { ...state.positions };
  if (remainingQty * price < 0.01) delete positions[mint];
  else positions[mint] = { ...pos, qty: remainingQty };

  const daily = { ...state.daily, realizedUsd: state.daily.realizedUsd + realized };

  if (kind === 'sell') {
    const trade: Trade = {
      id: makeId(),
      ts: now,
      mode: 'paper',
      kind: 'sell',
      symbol,
      qty: sellQty,
      priceUsd: fillPrice,
      usdValue: sellQty * fillPrice,
      feeUsd: PAPER_FEE_USD,
      slippageBps: risk.slippageBps,
      realizedPnlUsd: realized,
    };
    return {
      state: {
        ...state,
        cashUsd: state.cashUsd + proceeds,
        positions,
        daily,
        trades: [trade, ...state.trades],
      },
      trade,
    };
  }

  // rotate: use proceeds to buy the target token
  const { toMint, toSymbol } = params;
  if (!toMint || !toSymbol) return { state, error: 'Rotasyon hedefi seçilmedi.' };
  const toPrice = prices.get(toMint);
  if (!toPrice || toPrice <= 0) return { state, error: 'Hedef token fiyatı yok.' };

  const midState: PaperState = { ...state, cashUsd: state.cashUsd + proceeds, positions, daily };
  const dailyErr = checkDailyLoss(midState, risk, equityUsd(midState, prices));
  if (dailyErr) return { state, error: dailyErr };

  const eq = equityUsd(midState, prices);
  const existingTarget = midState.positions[toMint];
  const existingTargetValue = existingTarget ? existingTarget.qty * toPrice : 0;
  const maxUsd = (risk.maxPctPerCoin / 100) * eq;
  const buyUsd = Math.min(proceeds, Math.max(0, maxUsd - existingTargetValue));
  if (buyUsd <= PAPER_FEE_USD) {
    return { state, error: 'Rotasyon hedefi coin başına risk limitine takıldı.' };
  }

  const buyFill = toPrice * (1 + slip);
  const buyQty = (buyUsd - PAPER_FEE_USD) / buyFill;
  const newTarget: Position = existingTarget
    ? {
        ...existingTarget,
        qty: existingTarget.qty + buyQty,
        avgCostUsd:
          (existingTarget.qty * existingTarget.avgCostUsd + buyQty * buyFill) /
          (existingTarget.qty + buyQty),
      }
    : { mint: toMint, symbol: toSymbol, qty: buyQty, avgCostUsd: buyFill };

  const trade: Trade = {
    id: makeId(),
    ts: now,
    mode: 'paper',
    kind: 'rotate',
    symbol,
    toSymbol,
    qty: sellQty,
    priceUsd: fillPrice,
    usdValue: sellQty * fillPrice,
    feeUsd: PAPER_FEE_USD * 2,
    slippageBps: risk.slippageBps,
    realizedPnlUsd: realized,
    note: `${symbol} → ${toSymbol}`,
  };

  return {
    state: {
      ...midState,
      cashUsd: midState.cashUsd - buyUsd,
      positions: { ...midState.positions, [toMint]: newTarget },
      trades: [trade, ...midState.trades],
    },
    trade,
  };
}
