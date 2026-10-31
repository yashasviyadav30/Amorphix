import type { Category, Estimate, Tier } from "./costs.ts";

// The risk of going over budget, by simulation. Each trade's final cost is drawn around its estimate: spread by how
// uncertain that trade is (`cv`), skewed upward (`bias`: overruns are more common than savings), and tied to the
// others through one shared factor (prices and labour move together). A renovation adds hidden-condition risk to the
// trades that open walls and floors. Thousands of runs give the chance of going over and how much to keep aside.
// The figures are planning assumptions, not data from past projects; tune them here.

type Trade = { cv: number; bias: number };
const TRADE: Record<Category, Trade> = {
  construction: { cv: 0.2, bias: 0.06 },
  finishes: { cv: 0.12, bias: 0.03 },
  electrical: { cv: 0.16, bias: 0.04 },
  kitchen: { cv: 0.15, bias: 0.04 },
  bath: { cv: 0.18, bias: 0.05 },
  furniture: { cv: 0.1, bias: 0.02 },
  plants: { cv: 0.05, bias: 0 },
  fees: { cv: 0.05, bias: 0.01 },
};
// What opening up an existing home does to a trade's spread and drift (old wiring, damp, uneven floors).
const RENOVATION: Partial<Record<Category, number>> = { finishes: 1.4, electrical: 1.6, bath: 1.5, kitchen: 1.2 };
// Custom, made-to-order work at the top end is harder to price.
const TIER_CV: Record<Tier, number> = { essential: 0.9, mid: 1, premium: 1.1, luxury: 1.25 };
const SHARED = 0.5;

export type Risk = {
  /** The planned figure the chances are measured against: the estimate's midpoint before its range. */
  planned: number;
  p50: number;
  p80: number;
  p90: number;
  /** Chance the final cost goes over the planned figure, and over the top of the quoted range. */
  over: number;
  overRange: number;
  /** What to keep aside, on top of the planned figure, to be 80% sure of staying within it. */
  contingency: number;
  /** The trades that carry most of the risk, biggest first, with their share of it. */
  drivers: { category: Category; share: number }[];
};

// A small seeded generator, so the same design always shows the same figures.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const normal = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

export function risk(e: Estimate, newBuild = false, runs = 4000, seed = 7): Risk {
  const trades = (Object.entries(e.byCategory) as [Category, number][])
    .filter(([, v]) => v > 0)
    .map(([category, amount]) => {
      const reno = newBuild ? 1 : (RENOVATION[category] ?? 1);
      const cv = TRADE[category].cv * reno * TIER_CV[e.tier];
      return { category, amount, cv, bias: TRADE[category].bias * reno, sigma: Math.sqrt(Math.log(1 + cv * cv)) };
    });
  const planned = trades.reduce((s, t) => s + t.amount, 0);
  if (!planned) return { planned: 0, p50: 0, p80: 0, p90: 0, over: 0, overRange: 0, contingency: 0, drivers: [] };

  const r = rng(seed);
  const own = Math.sqrt(1 - SHARED * SHARED);
  const totals: number[] = [];
  for (let i = 0; i < runs; i++) {
    const common = normal(r);
    let total = 0;
    for (const t of trades) {
      const z = SHARED * common + own * normal(r);
      total += t.amount * (1 + t.bias) * Math.exp(t.sigma * z - (t.sigma * t.sigma) / 2);
    }
    totals.push(total);
  }
  totals.sort((a, b) => a - b);
  const top = (planned * e.total.high) / ((e.total.low + e.total.high) / 2 || 1);
  const variance = trades.map((t) => ({ category: t.category, v: (t.amount * t.cv) ** 2 }));
  const all = variance.reduce((s, x) => s + x.v, 0) || 1;
  const p80 = quantile(totals, 0.8);
  return {
    planned,
    p50: quantile(totals, 0.5),
    p80,
    p90: quantile(totals, 0.9),
    over: totals.filter((t) => t > planned).length / runs,
    overRange: totals.filter((t) => t > top).length / runs,
    contingency: Math.max(0, p80 - planned),
    drivers: variance
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map((x) => ({ category: x.category, share: x.v / all })),
  };
}
