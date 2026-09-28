'use client';

import { fmtPct, fmtPrice, fmtUsd } from '@/lib/format';
import { GROUP_LABELS } from '@/lib/tokens';
import type { ActionKind, ScoredRow } from '@/lib/types';

interface Props {
  scored: ScoredRow[];
  heldMints: Set<string>;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  onAction: (row: ScoredRow) => void;
  onRefresh: () => void;
}

const ACTION_STYLE: Record<ActionKind, string> = {
  AL: 'bg-up/15 text-up',
  SAT: 'bg-down/15 text-down',
  ROTASYON: 'bg-accent/20 text-violet-300',
  TUT: 'bg-ink-700 text-slate-300',
  BEKLE: 'bg-ink-800 text-slate-500',
};

function Pct({ v }: { v: number }) {
  const cls = v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-slate-400';
  return <span className={`font-mono ${cls}`}>{fmtPct(v)}</span>;
}

export default function BasketTable({
  scored,
  heldMints,
  loading,
  error,
  lastUpdated,
  onAction,
  onRefresh,
}: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 px-4 py-3">
        <h2 className="card-title">Meme Sepeti — Göreli Güç</h2>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          {error && <span className="text-amber-400">{error}</span>}
          {lastUpdated && (
            <span>
              Güncelleme:{' '}
              {new Date(lastUpdated).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          )}
          <button className="btn-ghost !px-2 !py-1 text-xs" onClick={onRefresh}>
            ↻ Yenile
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">#</th>
              <th className="px-2 py-2">Token</th>
              <th className="px-2 py-2 text-right">Fiyat</th>
              <th className="px-2 py-2 text-right">5d</th>
              <th className="px-2 py-2 text-right">1s</th>
              <th className="px-2 py-2 text-right">24s</th>
              <th className="px-2 py-2 text-right">Likidite</th>
              <th className="px-2 py-2 text-right">Skor (z)</th>
              <th className="px-2 py-2">Öneri</th>
              <th className="px-4 py-2 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading && scored.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  Piyasa verisi yükleniyor…
                </td>
              </tr>
            )}
            {scored.map((row) => {
              const held = heldMints.has(row.mint);
              return (
                <tr
                  key={row.mint}
                  className="border-b border-ink-800 transition-colors hover:bg-ink-850"
                >
                  <td className="px-4 py-2.5 font-mono text-slate-500">{row.rank}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{row.symbol}</span>
                      {held && (
                        <span className="badge bg-accent2/15 text-accent2" title="Pozisyon var">
                          P
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {GROUP_LABELS[row.group] ?? row.group}
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-slate-200">
                    {fmtPrice(row.priceUsd)}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <Pct v={row.change.m5} />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <Pct v={row.change.h1} />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <Pct v={row.change.h24} />
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-slate-400">
                    {fmtUsd(row.liquidityUsd, { compact: true })}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <span
                      className={`font-mono font-semibold ${
                        row.relScore > 0.3
                          ? 'text-up'
                          : row.relScore < -0.3
                            ? 'text-down'
                            : 'text-slate-300'
                      }`}
                    >
                      {row.relScore >= 0 ? '+' : ''}
                      {row.relScore.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <span
                      className={`badge ${ACTION_STYLE[row.action]}`}
                      title={row.reason}
                    >
                      {row.action}
                      {row.action === 'ROTASYON' && row.rotateTargetSymbol
                        ? ` → ${row.rotateTargetSymbol}`
                        : ''}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      className="btn-ghost !px-2.5 !py-1 text-xs"
                      onClick={() => onAction(row)}
                      title={row.reason}
                    >
                      Seç
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
