import type { MarketRow, ScoredRow, TokenGroup, TokenInfo } from './types';

/**
 * Rotasyon motoru: sepetteki her token için kısa vadeli momentumu hesaplar,
 * sepet ortalamasına göre normalize eder (göreli güç, z-skoru) ve
 * AL / SAT / ROTASYON / TUT / BEKLE önerisi üretir.
 *
 * Felsefe: favori coin yok. Benzer memeler (aynı grup) aynı varlığın farklı
 * bahis oranları gibi ele alınır — zayıflayan tutulmaz, güçlüye rotasyon yapılır.
 */

const W_M5 = 0.3;
const W_H1 = 0.4;
const W_H6 = 0.2;
const W_H24 = 0.1;
const W_VOL = 0.15;

const BUY_Z = 0.75; // not held, strong -> AL
const ROTATE_SOURCE_Z = -0.5; // held, weak -> rotate away
const ROTATE_TARGET_Z = 0.4; // needs a target at least this strong
const SAME_GROUP_TARGET_Z = 0.25; // same-group target gets a lower bar
const SELL_Z = -1.2; // held, very weak, no target -> SAT

function zScores(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  if (sd < 1e-9) return values.map(() => 0);
  return values.map((v) => (v - mean) / sd);
}

export function scoreBasket(
  rows: MarketRow[],
  tokens: TokenInfo[],
  heldMints: Set<string>
): ScoredRow[] {
  if (rows.length === 0) return [];
  const groupOf = new Map<string, TokenGroup>(tokens.map((t) => [t.mint, t.group]));

  const momentum = rows.map(
    (r) =>
      W_M5 * r.change.m5 + W_H1 * r.change.h1 + W_H6 * r.change.h6 + W_H24 * r.change.h24
  );
  const momZ = zScores(momentum);
  // Activity factor: 24h volume relative to liquidity (log-damped).
  const volZ = zScores(
    rows.map((r) => Math.log10(1 + r.volume24Usd / Math.max(1, r.liquidityUsd)))
  );

  const scored: ScoredRow[] = rows.map((r, i) => ({
    ...r,
    group: groupOf.get(r.mint) ?? 'absurt',
    momentum: momentum[i],
    relScore: momZ[i] + W_VOL * volZ[i],
    rank: 0,
    action: 'BEKLE',
    reason: '',
  }));

  scored.sort((a, b) => b.relScore - a.relScore);
  scored.forEach((s, i) => (s.rank = i + 1));

  const best = scored[0];

  for (const row of scored) {
    const held = heldMints.has(row.mint);

    if (held) {
      if (row.relScore <= ROTATE_SOURCE_Z) {
        // Prefer a strong token in the same group ("same asset, different odds").
        const sameGroup = scored.find(
          (s) =>
            s.mint !== row.mint &&
            s.group === row.group &&
            s.relScore >= SAME_GROUP_TARGET_Z &&
            !heldMints.has(s.mint)
        );
        const target =
          sameGroup ??
          (best.mint !== row.mint && best.relScore >= ROTATE_TARGET_Z && !heldMints.has(best.mint)
            ? best
            : undefined);
        if (target) {
          row.action = 'ROTASYON';
          row.rotateTargetMint = target.mint;
          row.rotateTargetSymbol = target.symbol;
          row.reason = sameGroup
            ? `Aynı grupta (${row.group}) daha güçlü: ${target.symbol} (z=${target.relScore.toFixed(2)})`
            : `Göreli güç zayıf (z=${row.relScore.toFixed(2)}), en güçlüye geç: ${target.symbol}`;
        } else if (row.relScore <= SELL_Z) {
          row.action = 'SAT';
          row.reason = `Çok zayıf (z=${row.relScore.toFixed(2)}) ve güçlü hedef yok — nakde dön`;
        } else {
          row.action = 'TUT';
          row.reason = `Zayıf ama satış eşiği altında değil (z=${row.relScore.toFixed(2)})`;
        }
      } else {
        row.action = 'TUT';
        row.reason = `Göreli güç yeterli (z=${row.relScore.toFixed(2)}, sıra #${row.rank})`;
      }
    } else {
      if (row.relScore >= BUY_Z && row.rank <= 3) {
        row.action = 'AL';
        row.reason = `Sepetin en güçlülerinden (z=${row.relScore.toFixed(2)}, sıra #${row.rank})`;
      } else {
        row.action = 'BEKLE';
        row.reason = `Sinyal yok (z=${row.relScore.toFixed(2)}, sıra #${row.rank})`;
      }
    }
  }

  return scored;
}

/** Pick the single highest-priority suggestion for the auto paper loop. */
export function topSuggestion(scored: ScoredRow[]): ScoredRow | null {
  const rotate = scored.find((s) => s.action === 'ROTASYON');
  if (rotate) return rotate;
  const sell = scored.find((s) => s.action === 'SAT');
  if (sell) return sell;
  const buy = scored.find((s) => s.action === 'AL');
  if (buy) return buy;
  return null;
}
