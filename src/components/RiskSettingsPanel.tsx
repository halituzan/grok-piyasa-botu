'use client';

import type { RiskSettings } from '@/lib/types';

interface Props {
  risk: RiskSettings;
  onChange: (risk: RiskSettings) => void;
}

function NumField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input
          className="input"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
        />
        <span className="shrink-0 text-slate-500">{suffix}</span>
      </div>
    </label>
  );
}

export default function RiskSettingsPanel({ risk, onChange }: Props) {
  return (
    <div className="card">
      <div className="border-b border-ink-700 px-4 py-3">
        <h2 className="card-title">Risk Ayarları</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">
        <NumField
          label="Coin başına maks."
          value={risk.maxPctPerCoin}
          min={1}
          max={100}
          step={1}
          suffix="%"
          onChange={(v) => onChange({ ...risk, maxPctPerCoin: v })}
        />
        <NumField
          label="Günlük zarar limiti"
          value={risk.dailyLossLimitPct}
          min={1}
          max={100}
          step={1}
          suffix="%"
          onChange={(v) => onChange({ ...risk, dailyLossLimitPct: v })}
        />
        <NumField
          label="Slippage"
          value={risk.slippageBps}
          min={10}
          max={2000}
          step={10}
          suffix="bps"
          onChange={(v) => onChange({ ...risk, slippageBps: v })}
        />
        <NumField
          label="Paper başlangıç"
          value={risk.startUsd}
          min={1}
          max={1_000_000}
          step={10}
          suffix="USD"
          onChange={(v) => onChange({ ...risk, startUsd: v })}
        />
        <div className="col-span-2 flex items-center justify-between rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5">
          <div>
            <div className="text-sm font-semibold text-slate-200">Otomatik paper rotasyon</div>
            <div className="text-[11px] text-slate-500">
              En güçlü öneriyi belirli aralıkla paper modda uygular. Canlı işlemler asla
              otomatik yapılmaz.
            </div>
          </div>
          <div className="flex items-center gap-2">
            {risk.autoPaper && (
              <input
                className="input !w-16 text-center"
                type="number"
                min={15}
                max={3600}
                step={15}
                value={risk.autoIntervalSec}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v))
                    onChange({ ...risk, autoIntervalSec: Math.min(3600, Math.max(15, v)) });
                }}
                title="Saniye"
              />
            )}
            <button
              role="switch"
              aria-checked={risk.autoPaper}
              onClick={() => onChange({ ...risk, autoPaper: !risk.autoPaper })}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                risk.autoPaper ? 'bg-accent' : 'bg-ink-600'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  risk.autoPaper ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
