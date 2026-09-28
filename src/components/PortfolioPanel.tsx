'use client';

import { useMemo } from 'react';
import { fmtPct, fmtPrice, fmtQty, fmtUsd } from '@/lib/format';
import { equityUsd, unrealizedPnlUsd } from '@/lib/paper';
import type { PaperState } from '@/lib/types';

interface Props {
  paper: PaperState;
  prices: Map<string, number>;
  onReset: () => void;
}

export default function PortfolioPanel({ paper, prices, onReset }: Props) {
  const equity = useMemo(() => equityUsd(paper, prices), [paper, prices]);
  const unrealized = useMemo(() => unrealizedPnlUsd(paper, prices), [paper, prices]);
  const totalPnl = equity - paper.startUsd;
  const totalPnlPct = paper.startUsd > 0 ? (totalPnl / paper.startUsd) * 100 : 0;
  const positions = Object.values(paper.positions);

  const pnlCls = (v: number) => (v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-slate-300');

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
        <h2 className="card-title">Paper Portföy</h2>
        <button
          className="btn-ghost !px-2 !py-1 text-xs"
          onClick={() => {
            if (window.confirm('Paper portföy sıfırlansın mı? İşlem geçmişi silinir.')) onReset();
          }}
        >
          Sıfırla
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <div>
          <div className="text-xs text-slate-500">Toplam Değer</div>
          <div className="font-mono text-lg font-bold text-white">{fmtUsd(equity)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Nakit</div>
          <div className="font-mono text-lg text-slate-200">{fmtUsd(paper.cashUsd)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Toplam PnL</div>
          <div className={`font-mono text-lg font-semibold ${pnlCls(totalPnl)}`}>
            {totalPnl >= 0 ? '+' : ''}
            {fmtUsd(totalPnl)}{' '}
            <span className="text-xs">({fmtPct(totalPnlPct)})</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Bugün Gerçekleşen</div>
          <div className={`font-mono text-lg ${pnlCls(paper.daily.realizedUsd)}`}>
            {paper.daily.realizedUsd >= 0 ? '+' : ''}
            {fmtUsd(paper.daily.realizedUsd)}
          </div>
        </div>
      </div>

      {positions.length > 0 && (
        <div className="overflow-x-auto border-t border-ink-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2">Token</th>
                <th className="px-2 py-2 text-right">Adet</th>
                <th className="px-2 py-2 text-right">Ort. Maliyet</th>
                <th className="px-2 py-2 text-right">Değer</th>
                <th className="px-4 py-2 text-right">PnL</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const p = prices.get(pos.mint) ?? 0;
                const value = pos.qty * p;
                const pnl = pos.qty * (p - pos.avgCostUsd);
                const pnlPct =
                  pos.avgCostUsd > 0 ? ((p - pos.avgCostUsd) / pos.avgCostUsd) * 100 : 0;
                return (
                  <tr key={pos.mint} className="border-t border-ink-800">
                    <td className="px-4 py-2 font-bold text-white">{pos.symbol}</td>
                    <td className="px-2 py-2 text-right font-mono text-slate-300">
                      {fmtQty(pos.qty)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-slate-400">
                      {fmtPrice(pos.avgCostUsd)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-slate-200">
                      {fmtUsd(value)}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${pnlCls(pnl)}`}>
                      {pnl >= 0 ? '+' : ''}
                      {fmtUsd(pnl)} <span className="text-xs">({fmtPct(pnlPct)})</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {positions.length === 0 && (
        <div className="border-t border-ink-700 px-4 py-4 text-center text-xs text-slate-500">
          Açık pozisyon yok. Sepetten bir öneri seçin veya işlem panelinden alım yapın.
          {unrealized === 0 ? '' : ''}
        </div>
      )}
    </div>
  );
}
