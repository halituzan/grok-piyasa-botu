'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_AUTOPILOT,
  decideHeuristic,
  sanitizeDecision,
  type AiResponse,
  type AiSnapshot,
  type AutopilotLogEntry,
  type AutopilotSettings,
} from '@/lib/autopilot';
import { equityUsd, PAPER_FEE_USD } from '@/lib/paper';
import { loadJson, saveJson } from '@/lib/storage';
import type { Mode, PaperState, RiskSettings, ScoredRow, TradeKind } from '@/lib/types';

const SETTINGS_KEY = 'gpb.autopilot.v1';
const LOG_KEY = 'gpb.autopilotLog.v1';
const LOG_CAP = 100;

interface Deps {
  mode: Mode;
  scored: ScoredRow[];
  prices: Map<string, number>;
  paper: PaperState;
  risk: RiskSettings;
  runPaperTrade: (params: {
    kind: TradeKind;
    mint: string;
    symbol: string;
    toMint?: string;
    toSymbol?: string;
    usd: number;
    prices: Map<string, number>;
  }) => { ok: boolean; error?: string };
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function useAutopilot(deps: Deps) {
  const [settings, setSettings] = useState<AutopilotSettings>(DEFAULT_AUTOPILOT);
  const [log, setLog] = useState<AutopilotLogEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [lastSource, setLastSource] = useState<'llm' | 'heuristic' | null>(null);
  const busyRef = useRef(false);

  const depsRef = useRef(deps);
  depsRef.current = deps;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    setSettings({ ...DEFAULT_AUTOPILOT, ...loadJson<AutopilotSettings>(SETTINGS_KEY, DEFAULT_AUTOPILOT), enabled: false });
    setLog(loadJson<AutopilotLogEntry[]>(LOG_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveJson(SETTINGS_KEY, settings);
  }, [settings, hydrated]);
  useEffect(() => {
    if (hydrated) saveJson(LOG_KEY, log);
  }, [log, hydrated]);

  const pushLog = useCallback((entry: AutopilotLogEntry) => {
    setLog((prev) => [entry, ...prev].slice(0, LOG_CAP));
  }, []);

  const clearLog = useCallback(() => setLog([]), []);

  const liquidateAll = useCallback((reason: string): boolean => {
    const { paper, prices, runPaperTrade } = depsRef.current;
    let allOk = true;
    for (const pos of Object.values(paper.positions)) {
      const price = prices.get(pos.mint);
      if (!price) {
        allOk = false;
        continue;
      }
      const res = runPaperTrade({
        kind: 'sell',
        mint: pos.mint,
        symbol: pos.symbol,
        usd: pos.qty * price,
        prices,
      });
      if (!res.ok) allOk = false;
    }
    void reason;
    return allOk;
  }, []);

  const tick = useCallback(async () => {
    if (busyRef.current) return;
    const { mode, scored, prices, paper, risk, runPaperTrade } = depsRef.current;
    const cfg = settingsRef.current;
    if (mode !== 'paper' || scored.length === 0) return;

    busyRef.current = true;
    setThinking(true);
    try {
      const equity = equityUsd(paper, prices);
      const allPriced = Object.keys(paper.positions).every((m) => prices.has(m));

      // Alt / üst limit koruması: her şeyi sat ve otopilotu durdur.
      if (allPriced && (equity <= cfg.floorUsd || equity >= cfg.ceilingUsd)) {
        const isFloor = equity <= cfg.floorUsd;
        liquidateAll(isFloor ? 'alt limit' : 'üst limit');
        setSettings((s) => ({ ...s, enabled: false }));
        pushLog({
          id: makeId(),
          ts: Date.now(),
          decision: {
            action: 'hold',
            reason: isFloor
              ? `ALT LİMİT: Toplam değer ${equity.toFixed(2)} USD ≤ ${cfg.floorUsd} USD. Tüm pozisyonlar satıldı, otopilot durduruldu.`
              : `ÜST LİMİT: Toplam değer ${equity.toFixed(2)} USD ≥ ${cfg.ceilingUsd} USD. Kâr realize edildi, otopilot durduruldu.`,
          },
          source: 'limit',
          executed: true,
          equityUsd: equity,
        });
        return;
      }

      const snapshot: AiSnapshot = {
        rows: scored.map((r) => ({
          mint: r.mint,
          symbol: r.symbol,
          group: r.group,
          priceUsd: r.priceUsd,
          m5: r.change.m5,
          h1: r.change.h1,
          h6: r.change.h6,
          h24: r.change.h24,
          relScore: Number(r.relScore.toFixed(3)),
          rank: r.rank,
          liquidityUsd: Math.round(r.liquidityUsd),
        })),
        positions: Object.values(paper.positions).map((p) => {
          const price = prices.get(p.mint) ?? 0;
          const row = scored.find((r) => r.mint === p.mint);
          return {
            mint: p.mint,
            symbol: p.symbol,
            qty: p.qty,
            avgCostUsd: p.avgCostUsd,
            valueUsd: p.qty * price,
            pnlPct: p.avgCostUsd > 0 ? ((price - p.avgCostUsd) / p.avgCostUsd) * 100 : 0,
            relScore: row ? Number(row.relScore.toFixed(3)) : 0,
          };
        }),
        cashUsd: paper.cashUsd,
        equityUsd: equity,
        startUsd: paper.startUsd,
        dailyRealizedUsd: paper.daily.realizedUsd,
        risk: {
          maxPctPerCoin: risk.maxPctPerCoin,
          dailyLossLimitPct: risk.dailyLossLimitPct,
          slippageBps: risk.slippageBps,
        },
        limits: { floorUsd: cfg.floorUsd, ceilingUsd: cfg.ceilingUsd },
        feePerTradeUsd: PAPER_FEE_USD,
        minEdgeRatio: cfg.minEdgeRatio,
      };

      let response: AiResponse;
      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(snapshot),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        response = (await res.json()) as AiResponse;
      } catch {
        response = { decision: decideHeuristic(snapshot), source: 'heuristic' };
      }

      // Sunucudan gelse bile karar burada da doğrulanır.
      const decision =
        response.decision.action === 'hold'
          ? response.decision
          : sanitizeDecision(response.decision, snapshot) ?? {
              action: 'hold' as const,
              reason: 'AI kararı risk sınırlarını geçemedi — bekleniyor.',
            };

      setLastSource(response.source);

      if (decision.action === 'hold') {
        pushLog({
          id: makeId(),
          ts: Date.now(),
          decision,
          source: response.source,
          executed: true,
          equityUsd: equity,
        });
        return;
      }

      const symbolOf = (mint: string) =>
        scored.find((r) => r.mint === mint)?.symbol ??
        paper.positions[mint]?.symbol ??
        mint.slice(0, 4);

      const res = runPaperTrade({
        kind: decision.action as TradeKind,
        mint: decision.mint!,
        symbol: symbolOf(decision.mint!),
        toMint: decision.toMint,
        toSymbol: decision.toMint ? symbolOf(decision.toMint) : undefined,
        usd: decision.usd!,
        prices,
      });

      pushLog({
        id: makeId(),
        ts: Date.now(),
        decision,
        source: response.source,
        executed: res.ok,
        error: res.error,
        equityUsd: equity,
      });
    } finally {
      busyRef.current = false;
      setThinking(false);
    }
  }, [liquidateAll, pushLog]);

  useEffect(() => {
    if (!settings.enabled || deps.mode !== 'paper') return;
    const first = setTimeout(tick, 3_000);
    const id = setInterval(tick, Math.max(15, settings.intervalSec) * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.enabled, settings.intervalSec, deps.mode, tick]);

  return {
    settings,
    setSettings,
    log,
    clearLog,
    thinking,
    lastSource,
    tickNow: tick,
    running: settings.enabled && deps.mode === 'paper',
  };
}

export type Autopilot = ReturnType<typeof useAutopilot>;
