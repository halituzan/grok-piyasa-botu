export function fmtUsd(v: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(v)) return '—';
  if (opts?.compact && Math.abs(v) >= 1000) {
    return Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(v) + ' USD';
  }
  const abs = Math.abs(v);
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : abs >= 0.0001 ? 6 : 8;
  return (
    Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: digits,
    }).format(v) + ' USD'
  );
}

export function fmtPrice(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const digits = abs >= 1 ? 4 : abs >= 0.01 ? 5 : abs >= 0.0001 ? 7 : 9;
  return '$' + Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(v);
}

export function fmtPct(v: number | undefined | null, signed = true): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '—';
  const s = signed && v > 0 ? '+' : '';
  return `${s}${v.toFixed(2)}%`;
}

export function fmtQty(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return Intl.NumberFormat('en-US', { maximumFractionDigits: v >= 1000 ? 0 : 4 }).format(v);
}

export function shortAddr(addr: string, len = 4): string {
  if (addr.length <= len * 2 + 3) return addr;
  return `${addr.slice(0, len)}…${addr.slice(-len)}`;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
