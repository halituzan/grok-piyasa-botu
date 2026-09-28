'use client';

import type { Autopilot } from '@/hooks/useAutopilot';
import { fmtTime, fmtUsd } from '@/lib/format';
import type { Mode } from '@/lib/types';

interface Props {
  autopilot: Autopilot;
  mode: Mode;
}

const ACTION_BADGE: Record<string, { label: string; cls: string }> = {
  buy: { label: 'AL', cls: 'bg-up/15 text-up' },
  sell: { label: 'SAT', cls: 'bg-down/15 text-down' },
  rotate: { label: 'ROT', cls: 'bg-accent/20 text-violet-300' },
  hold: { label: 'BEKLE', cls: 'bg-ink-700 text-slate-400' },
};

function LimitField({
  label,
  value,
  min,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <div className="mt-1 flex items-center gap-1.5">
        <input
          className="input"
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.max(min, v));
          }}
        />
        <span className="shrink-0 text-slate-500">{suffix}</span>
      </div>
    </label>
  );
}

export default function AutopilotPanel({ autopilot, mode }: Props) {
  const { settings, setSettings, log, clearLog, thinking, lastSource, tickNow, running } =
    autopilot;

  return (
    <div className="card">
      <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
        <h2 className="card-title">🤖 AI Otopilot</h2>
        <span
          className={`ml-1 inline-block h-2 w-2 rounded-full ${
            running ? (thinking ? 'animate-pulse bg-amber-400' : 'bg-up') : 'bg-ink-600'
          }`}
          title={running ? (thinking ? 'Karar veriliyor' : 'Çalışıyor') : 'Kapalı'}
        />
        <div className="ml-auto flex items-center gap-2">
          {lastSource && (
            <span className="text-[11px] text-slate-500">
              Motor: {lastSource === 'llm' ? 'Grok (LLM)' : 'Yerleşik sezgisel'}
            </span>
          )}
          <button
            role="switch"
            aria-checked={settings.enabled}
            onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              settings.enabled ? 'bg-accent' : 'bg-ink-600'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                settings.enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {mode === 'live' && settings.enabled && (
          <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Canlı modda otopilot duraklatıldı. Güvenlik gereği canlı işlemler otomatik
            yapılmaz; her swap cüzdanınızda imzalanmalıdır. Paper moda dönün.
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-slate-500">
          Otopilot, belirlediğiniz aralıkta piyasa ve portföy görüntüsünü AI karar motoruna
          gönderir; ücret + slippage maliyetini hesaba katarak AL / SAT / ROTASYON / BEKLE
          kararını kendisi verir ve paper portföyde anında uygular. Toplam değer alt limite
          düşerse veya üst limite ulaşırsa tüm pozisyonlar satılır ve otopilot durur.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <LimitField
            label="Alt limit (stop)"
            value={settings.floorUsd}
            min={0}
            step={1}
            suffix="USD"
            onChange={(v) => setSettings({ ...settings, floorUsd: v })}
          />
          <LimitField
            label="Üst limit (hedef)"
            value={settings.ceilingUsd}
            min={1}
            step={1}
            suffix="USD"
            onChange={(v) => setSettings({ ...settings, ceilingUsd: v })}
          />
          <LimitField
            label="Karar aralığı"
            value={settings.intervalSec}
            min={15}
            step={15}
            suffix="sn"
            onChange={(v) => setSettings({ ...settings, intervalSec: v })}
          />
          <LimitField
            label="Min. kenar/maliyet"
            value={settings.minEdgeRatio}
            min={1}
            step={0.1}
            suffix="×"
            onChange={(v) => setSettings({ ...settings, minEdgeRatio: v })}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn-ghost flex-1 text-xs"
            onClick={() => tickNow()}
            disabled={thinking || mode !== 'paper'}
          >
            {thinking ? 'Karar veriliyor…' : 'Şimdi karar ver'}
          </button>
          <button className="btn-ghost text-xs" onClick={clearLog} disabled={log.length === 0}>
            Günlüğü temizle
          </button>
        </div>

        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {log.length === 0 ? (
            <p className="py-2 text-center text-xs text-slate-600">Henüz AI kararı yok.</p>
          ) : (
            log.map((entry) => {
              const badge =
                entry.source === 'limit'
                  ? { label: 'LİMİT', cls: 'bg-amber-500/15 text-amber-300' }
                  : ACTION_BADGE[entry.decision.action] ?? ACTION_BADGE.hold;
              return (
                <div
                  key={entry.id}
                  className="rounded-lg border border-ink-800 bg-ink-850 px-2.5 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className={`badge ${badge.cls}`}>{badge.label}</span>
                    {entry.decision.usd !== undefined && (
                      <span className="font-mono text-slate-300">
                        {fmtUsd(entry.decision.usd)}
                      </span>
                    )}
                    {!entry.executed && (
                      <span className="text-down" title={entry.error}>
                        ✗ uygulanamadı
                      </span>
                    )}
                    <span className="ml-auto font-mono text-[10px] text-slate-600">
                      {entry.source === 'llm' ? 'LLM' : entry.source === 'limit' ? '' : 'SEZG'}
                      {' · '}
                      {fmtTime(entry.ts)}
                    </span>
                  </div>
                  <p className="mt-1 leading-snug text-slate-400">{entry.decision.reason}</p>
                  {entry.error && <p className="mt-0.5 text-down">{entry.error}</p>}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
