'use client';

import { useState } from 'react';
import { fmtPrice, fmtQty, fmtTime, fmtUsd } from '@/lib/format';
import { solscanTxUrl } from '@/lib/jupiter';
import type { Trade } from '@/lib/types';

interface Props {
  paperTrades: Trade[];
  liveTrades: Trade[];
}

const KIND_BADGE: Record<Trade['kind'], { label: string; cls: string }> = {
  buy: { label: 'AL', cls: 'bg-up/15 text-up' },
  sell: { label: 'SAT', cls: 'bg-down/15 text-down' },
  rotate: { label: 'ROT', cls: 'bg-accent/20 text-violet-300' },
};

export default function TradeHistory({ paperTrades, liveTrades }: Props) {
  const [tab, setTab] = useState<'paper' | 'live'>('paper');
  const trades = tab === 'paper' ? paperTrades : liveTrades;

  return (
    <div className="card">
      <div className="flex items-center gap-3 border-b border-ink-700 px-4 py-3">
        <h2 className="card-title">İşlem Geçmişi</h2>
        <div className="ml-auto flex rounded-lg border border-ink-600 p-0.5 text-xs">
          <button
            className={`rounded-md px-2.5 py-1 font-semibold ${
              tab === 'paper' ? 'bg-accent2/20 text-accent2' : 'text-slate-400'
            }`}
            onClick={() => setTab('paper')}
          >
            Paper ({paperTrades.length})
          </button>
          <button
            className={`rounded-md px-2.5 py-1 font-semibold ${
              tab === 'live' ? 'bg-down/20 text-down' : 'text-slate-400'
            }`}
            onClick={() => setTab('live')}
          >
            Canlı ({liveTrades.length})
          </button>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {trades.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-slate-500">
            {tab === 'paper' ? 'Henüz paper işlem yok.' : 'Henüz canlı işlem yok.'}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-ink-900">
              <tr className="text-left uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2">Zaman</th>
                <th className="px-2 py-2">Tür</th>
                <th className="px-2 py-2">Token</th>
                <th className="px-2 py-2 text-right">Adet</th>
                <th className="px-2 py-2 text-right">Fiyat</th>
                <th className="px-2 py-2 text-right">Tutar</th>
                <th className="px-2 py-2 text-right">PnL</th>
                <th className="px-4 py-2 text-right">Tx</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => {
                const badge = KIND_BADGE[t.kind];
                return (
                  <tr key={t.id} className="border-t border-ink-800">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-slate-500">
                      {fmtTime(t.ts)}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`badge ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-2 py-2 font-semibold text-white">
                      {t.kind === 'rotate' && t.toSymbol
                        ? `${t.symbol} → ${t.toSymbol}`
                        : t.symbol}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-slate-300">
                      {fmtQty(t.qty)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-slate-400">
                      {fmtPrice(t.priceUsd)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-slate-300">
                      {fmtUsd(t.usdValue)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">
                      {t.realizedPnlUsd === undefined ? (
                        <span className="text-slate-600">—</span>
                      ) : (
                        <span className={t.realizedPnlUsd >= 0 ? 'text-up' : 'text-down'}>
                          {t.realizedPnlUsd >= 0 ? '+' : ''}
                          {fmtUsd(t.realizedPnlUsd)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {t.signature ? (
                        <a
                          className="text-accent2 underline hover:text-white"
                          href={solscanTxUrl(t.signature)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Solscan ↗
                        </a>
                      ) : (
                        <span className="text-slate-600">paper</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
