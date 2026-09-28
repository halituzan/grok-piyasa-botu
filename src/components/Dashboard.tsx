'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useBotState } from '@/hooks/useBotState';
import { useMarketData } from '@/hooks/useMarketData';
import { scoreBasket, topSuggestion } from '@/lib/rotation';
import type { ScoredRow } from '@/lib/types';
import ActionPanel, { type ActionSelection } from './ActionPanel';
import BasketEditor from './BasketEditor';
import BasketTable from './BasketTable';
import Header from './Header';
import PortfolioPanel from './PortfolioPanel';
import RiskBanner from './RiskBanner';
import RiskSettingsPanel from './RiskSettingsPanel';
import TradeHistory from './TradeHistory';

export default function Dashboard() {
  const bot = useBotState();
  const mints = useMemo(() => bot.basket.map((t) => t.mint), [bot.basket]);
  const market = useMarketData(mints);
  const [selection, setSelection] = useState<ActionSelection | null>(null);

  const prices = useMemo(() => {
    const m = new Map<string, number>();
    market.rows.forEach((row, mint) => m.set(mint, row.priceUsd));
    return m;
  }, [market.rows]);

  const heldMints = useMemo(
    () => new Set(Object.keys(bot.paper.positions)),
    [bot.paper.positions]
  );

  const scored = useMemo(() => {
    const rows = bot.basket
      .map((t) => market.rows.get(t.mint))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
    return scoreBasket(rows, bot.basket, heldMints);
  }, [bot.basket, market.rows, heldMints]);

  const handleRowAction = (row: ScoredRow) => {
    const kind =
      row.action === 'AL' || row.action === 'BEKLE'
        ? 'buy'
        : row.action === 'SAT'
          ? 'sell'
          : row.action === 'ROTASYON'
            ? 'rotate'
            : heldMints.has(row.mint)
              ? 'sell'
              : 'buy';
    setSelection({
      kind,
      mint: row.mint,
      toMint: row.rotateTargetMint,
      nonce: Date.now(),
    });
  };

  // Auto paper loop: applies the top suggestion on an interval. Paper only.
  const autoRef = useRef({ bot, scored, prices });
  autoRef.current = { bot, scored, prices };

  useEffect(() => {
    if (!bot.risk.autoPaper || bot.mode !== 'paper') return;
    const id = setInterval(() => {
      const { bot: b, scored: s, prices: p } = autoRef.current;
      if (b.mode !== 'paper' || s.length === 0) return;
      const pick = topSuggestion(s);
      if (!pick) return;
      const equity = b.paper.cashUsd; // sizing base: available cash for buys
      if (pick.action === 'AL') {
        const usd = Math.min(equity, Math.max(5, equity * (b.risk.maxPctPerCoin / 100)));
        if (usd >= 1) {
          b.runPaperTrade({
            kind: 'buy',
            mint: pick.mint,
            symbol: pick.symbol,
            usd,
            prices: p,
          });
        }
      } else if (pick.action === 'SAT' || pick.action === 'ROTASYON') {
        const pos = b.paper.positions[pick.mint];
        const price = p.get(pick.mint);
        if (!pos || !price) return;
        const usd = pos.qty * price;
        if (usd < 0.5) return;
        b.runPaperTrade({
          kind: pick.action === 'SAT' ? 'sell' : 'rotate',
          mint: pick.mint,
          symbol: pick.symbol,
          toMint: pick.rotateTargetMint,
          toSymbol: pick.rotateTargetSymbol,
          usd,
          prices: p,
        });
      }
    }, bot.risk.autoIntervalSec * 1000);
    return () => clearInterval(id);
  }, [bot.risk.autoPaper, bot.risk.autoIntervalSec, bot.mode]);

  if (!bot.hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Yükleniyor…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header mode={bot.mode} onModeChange={bot.setMode} />
      {bot.mode === 'live' && <RiskBanner />}

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <BasketTable
            scored={scored}
            heldMints={heldMints}
            loading={market.loading}
            error={market.error}
            lastUpdated={market.lastUpdated}
            onAction={handleRowAction}
            onRefresh={market.refresh}
          />
          <PortfolioPanel paper={bot.paper} prices={prices} onReset={bot.resetPaper} />
          <TradeHistory paperTrades={bot.paper.trades} liveTrades={bot.liveTrades} />
        </div>

        <div className="space-y-4">
          <ActionPanel
            mode={bot.mode}
            basket={bot.basket}
            prices={prices}
            solPrice={market.solPrice}
            risk={bot.risk}
            paper={bot.paper}
            runPaperTrade={bot.runPaperTrade}
            addLiveTrade={bot.addLiveTrade}
            selection={selection}
          />
          <RiskSettingsPanel risk={bot.risk} onChange={bot.setRisk} />
          <BasketEditor
            allTokens={bot.allTokens}
            disabled={bot.basketCfg.disabled}
            onToggle={bot.toggleToken}
            onAdd={bot.addCustomToken}
            onRemove={bot.removeCustomToken}
          />
          <p className="px-1 text-[11px] leading-relaxed text-slate-600">
            Bu uygulama özel anahtar veya seed phrase istemez, saklamaz ve iletmez. Canlı
            işlemler yalnızca kendi cüzdanınızda (Phantom, Solflare, Backpack…) imzalanır.
            Piyasa verisi: DexScreener · Swap altyapısı: Jupiter. Yatırım tavsiyesi değildir.
          </p>
        </div>
      </main>
    </div>
  );
}
