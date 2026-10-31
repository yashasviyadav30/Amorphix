import { BRANDS } from "../taste/brands.ts";
import type { Profile } from "../taste/types.ts";
import { TIERS, type Tier } from "./costs.ts";

// The quality tier a budget starts at, read from the price of the brands closest to their taste: someone whose taste
// sits by Restoration Hardware and Good Earth starts higher than someone whose taste sits by IKEA and H&M Home.

export type PriceSignal = { name: string; level: 1 | 2 | 3 | 4; says: string };

const clamp = (n: number) => Math.min(4, Math.max(1, Math.round(n))) as 1 | 2 | 3 | 4;
const LEVEL = new Map(BRANDS.map((b) => [b.id, b.level]));

/** The price signals of their closest brands, best match first. */
export function priceSignals(taste: Profile | null, n = 3): PriceSignal[] {
  return (taste?.brands ?? []).flatMap((b) => {
    const level = LEVEL.get(b.id);
    return level ? [{ name: b.name, level, says: `a ${"$".repeat(level)} brand` }] : [];
  }).slice(0, n);
}

/** Pure: the tier from price signals (their average level), with the signals behind it. */
export function tierFrom(signals: PriceSignal[]): { tier: Tier; signals: PriceSignal[] } {
  if (!signals.length) return { tier: "mid", signals };
  const avg = signals.reduce((a, s) => a + s.level, 0) / signals.length;
  return { tier: TIERS[clamp(avg) - 1], signals };
}

export const tasteTier = (taste: Profile | null) => tierFrom(priceSignals(taste));
