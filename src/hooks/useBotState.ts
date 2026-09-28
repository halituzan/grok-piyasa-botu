'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { executePaperTrade, initialPaperState, type TradeParams } from '@/lib/paper';
import { KEYS, loadJson, saveJson } from '@/lib/storage';
import { DEFAULT_BASKET } from '@/lib/tokens';
import {
  DEFAULT_RISK,
  type Mode,
  type PaperState,
  type RiskSettings,
  type TokenInfo,
  type Trade,
} from '@/lib/types';

interface BasketConfig {
  /** Mints disabled by the user (from the default basket). */
  disabled: string[];
  /** User-added tokens. */
  custom: TokenInfo[];
}

export function useBotState() {
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<Mode>('paper'); // always boot in paper — safety default
  const [risk, setRisk] = useState<RiskSettings>(DEFAULT_RISK);
  const [paper, setPaper] = useState<PaperState>(() => initialPaperState(DEFAULT_RISK.startUsd));
  const [liveTrades, setLiveTrades] = useState<Trade[]>([]);
  const [basketCfg, setBasketCfg] = useState<BasketConfig>({ disabled: [], custom: [] });

  const paperRef = useRef(paper);
  paperRef.current = paper;

  useEffect(() => {
    const r = loadJson<RiskSettings>(KEYS.risk, DEFAULT_RISK);
    setRisk({ ...DEFAULT_RISK, ...r });
    setPaper(loadJson<PaperState>(KEYS.paper, initialPaperState(r.startUsd ?? DEFAULT_RISK.startUsd)));
    setLiveTrades(loadJson<Trade[]>(KEYS.liveTrades, []));
    setBasketCfg(loadJson<BasketConfig>(KEYS.basket, { disabled: [], custom: [] }));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveJson(KEYS.paper, paper);
  }, [paper, hydrated]);
  useEffect(() => {
    if (hydrated) saveJson(KEYS.risk, risk);
  }, [risk, hydrated]);
  useEffect(() => {
    if (hydrated) saveJson(KEYS.liveTrades, liveTrades);
  }, [liveTrades, hydrated]);
  useEffect(() => {
    if (hydrated) saveJson(KEYS.basket, basketCfg);
  }, [basketCfg, hydrated]);

  const basket: TokenInfo[] = useMemo(() => {
    const disabled = new Set(basketCfg.disabled);
    return [...DEFAULT_BASKET, ...basketCfg.custom].filter((t) => !disabled.has(t.mint));
  }, [basketCfg]);

  const allTokens: TokenInfo[] = useMemo(
    () => [...DEFAULT_BASKET, ...basketCfg.custom],
    [basketCfg.custom]
  );

  const toggleToken = useCallback((mint: string) => {
    setBasketCfg((cfg) => {
      const disabled = new Set(cfg.disabled);
      if (disabled.has(mint)) disabled.delete(mint);
      else disabled.add(mint);
      return { ...cfg, disabled: [...disabled] };
    });
  }, []);

  const addCustomToken = useCallback((token: TokenInfo) => {
    setBasketCfg((cfg) => {
      if (cfg.custom.some((t) => t.mint === token.mint)) return cfg;
      if (DEFAULT_BASKET.some((t) => t.mint === token.mint)) return cfg;
      return { ...cfg, custom: [...cfg.custom, token] };
    });
  }, []);

  const removeCustomToken = useCallback((mint: string) => {
    setBasketCfg((cfg) => ({ ...cfg, custom: cfg.custom.filter((t) => t.mint !== mint) }));
  }, []);

  const runPaperTrade = useCallback(
    (params: Omit<TradeParams, 'risk'>): { ok: boolean; error?: string } => {
      const res = executePaperTrade(paperRef.current, { ...params, risk });
      if (res.error) return { ok: false, error: res.error };
      paperRef.current = res.state;
      setPaper(res.state);
      return { ok: true };
    },
    [risk]
  );

  const resetPaper = useCallback(() => {
    setPaper(initialPaperState(risk.startUsd));
  }, [risk.startUsd]);

  const addLiveTrade = useCallback((trade: Trade) => {
    setLiveTrades((prev) => [trade, ...prev]);
  }, []);

  return {
    hydrated,
    mode,
    setMode,
    risk,
    setRisk,
    paper,
    runPaperTrade,
    resetPaper,
    liveTrades,
    addLiveTrade,
    basket,
    allTokens,
    basketCfg,
    toggleToken,
    addCustomToken,
    removeCustomToken,
  };
}

export type BotState = ReturnType<typeof useBotState>;
