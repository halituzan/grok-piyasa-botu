'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMarketRows, RateLimitError } from '@/lib/market';
import { SOL_MINT } from '@/lib/tokens';
import type { MarketRow } from '@/lib/types';

const BASE_INTERVAL_MS = 25_000;
const MAX_INTERVAL_MS = 5 * 60_000;

export function useMarketData(mints: string[]) {
  const [rows, setRows] = useState<Map<string, MarketRow>>(new Map());
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const intervalRef = useRef(BASE_INTERVAL_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mintsKey = mints.join(',');

  const refresh = useCallback(async () => {
    try {
      const all = await fetchMarketRows([...mintsKey.split(',').filter(Boolean), SOL_MINT]);
      const sol = all.get(SOL_MINT);
      if (sol) setSolPrice(sol.priceUsd);
      all.delete(SOL_MINT);
      setRows(all);
      setLastUpdated(Date.now());
      setError(null);
      intervalRef.current = BASE_INTERVAL_MS;
    } catch (e) {
      if (e instanceof RateLimitError) {
        intervalRef.current = Math.min(intervalRef.current * 2, MAX_INTERVAL_MS);
        setError('API hız limiti — yenileme aralığı otomatik artırıldı.');
      } else {
        setError('Piyasa verisi alınamadı. Tekrar denenecek.');
      }
    } finally {
      setLoading(false);
    }
  }, [mintsKey]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refresh();
      if (cancelled) return;
      timerRef.current = setTimeout(tick, intervalRef.current);
    };
    setLoading(true);
    tick();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [refresh]);

  return { rows, solPrice, loading, error, lastUpdated, refresh };
}
