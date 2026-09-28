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
      </div>
    </div>
  );
}
