export function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — paper state is best-effort
  }
}

export const KEYS = {
  paper: 'gpb.paper.v1',
  liveTrades: 'gpb.liveTrades.v1',
  risk: 'gpb.risk.v1',
  basket: 'gpb.basket.v1',
} as const;
