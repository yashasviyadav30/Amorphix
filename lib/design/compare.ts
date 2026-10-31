import type { Layout, Space } from "../layout/schema.ts";
import { isOpen } from "../layout/walls.ts";

// What each plan option does best, and what it gives up, measured against the other options. The site is
// limited, so every layout trades one room's size for another's; this makes the trade visible on the cards.
// Claims come only from measured areas, and only when the difference is big enough to notice (8% or more).

export type Measure = "living" | "kitchen" | "open" | "primary" | "bedrooms" | "halls";
/** A claim about one option: which measure, its value (m² or a share for halls), and whether it's the best or worst. */
export type Claim = { measure: Measure; value: number; best: boolean };

const area = (s: Space) => s.rect.w * s.rect.h;
const spaces = (l: Layout) => l.floors.flatMap((f) => f.spaces);
const biggest = (l: Layout, kinds: string[]) => Math.max(0, ...spaces(l).filter((s) => kinds.includes(s.kind)).map(area));

/** The measures for one layout. Missing rooms measure 0 and are left out of the comparison. */
export function measure(l: Layout): Record<Measure, number> {
  const beds = spaces(l).filter((s) => s.kind === "bedroom").map(area).sort((a, b) => b - a);
  const all = spaces(l).reduce((t, s) => t + area(s), 0);
  const halls = spaces(l).filter((s) => s.zone === "circulation").reduce((t, s) => t + area(s), 0);
  return {
    living: biggest(l, ["living", "lounge"]),
    kitchen: biggest(l, ["kitchen"]),
    // The shared living space: public rooms that open into each other.
    open: l.floors[0]?.spaces.filter((s) => s.zone === "public" && isOpen(s)).reduce((t, s) => t + area(s), 0) ?? 0,
    primary: beds[0] ?? 0,
    // The other bedrooms, on average (the kids' or guest rooms).
    bedrooms: beds.length > 1 ? beds.slice(1).reduce((t, a) => t + a, 0) / (beds.length - 1) : 0,
    // Share of the floor area spent on halls and stairs: lower is better.
    halls: all ? halls / all : 0,
  };
}

const LOWER_IS_BETTER = new Set<Measure>(["halls"]);
const NOTICEABLE = 0.08;

/** For each option, its claims against the others: up to three things it does best, and its biggest give-up. */
export function compare(layouts: Layout[]): { gains: Claim[]; gives: Claim[] }[] {
  const ms = layouts.map(measure);
  const out = layouts.map(() => ({ gains: [] as Claim[], gives: [] as Claim[] }));
  if (layouts.length < 2) return out;
  for (const key of Object.keys(ms[0]) as Measure[]) {
    const values = ms.map((m) => m[key]);
    if (values.some((v) => v <= 0)) continue; // a room one option lacks isn't a fair comparison
    const hi = Math.max(...values);
    const lo = Math.min(...values);
    if ((hi - lo) / hi < NOTICEABLE) continue;
    const [bestV, worstV] = LOWER_IS_BETTER.has(key) ? [lo, hi] : [hi, lo];
    // Only a clear winner or loser: ties don't make a claim.
    const best = values.filter((v) => v === bestV).length === 1 ? values.indexOf(bestV) : -1;
    const worst = values.filter((v) => v === worstV).length === 1 ? values.indexOf(worstV) : -1;
    if (best >= 0) out[best].gains.push({ measure: key, value: bestV, best: true });
    if (worst >= 0) out[worst].gives.push({ measure: key, value: worstV, best: false });
  }
  // Keep the strongest claims: the largest relative gaps first.
  const gap = (c: Claim) => {
    const values = ms.map((m) => m[c.measure]);
    return (Math.max(...values) - Math.min(...values)) / Math.max(...values);
  };
  return out.map(({ gains, gives }) => ({
    gains: gains.sort((a, b) => gap(b) - gap(a)).slice(0, 3),
    gives: gives.sort((a, b) => gap(b) - gap(a)).slice(0, 1),
  }));
}

const SQFT = 10.7639;
const size = (m2: number, units: "imperial" | "metric") => (units === "metric" ? `${Math.round(m2)} m²` : `${Math.round((m2 * SQFT) / 5) * 5} sq ft`);

/** A claim in plain words, in the project's units. */
export function sayClaim(c: Claim, units: "imperial" | "metric" = "imperial", home = true): string {
  const v = size(c.value, units);
  // A café, office or shop has guest spaces, not a living room.
  if (!home && c.measure === "open") return c.best ? `The most open space for guests (${v})` : `The least open space for guests (${v})`;
  if (!home && c.measure === "living") return c.best ? `The biggest lounge of the three (${v})` : `The smallest lounge of the three (${v})`;
  const pct = `${Math.round(c.value * 100)}%`;
  if (c.best)
    return {
      living: `The biggest living room of the three (${v})`,
      kitchen: `The biggest kitchen (${v})`,
      open: `The most open living space (${v} of living, dining and kitchen together)`,
      primary: `The largest main bedroom (${v})`,
      bedrooms: `The roomiest other bedrooms (${v} each on average)`,
      halls: `The least floor lost to halls and stairs (${pct})`,
    }[c.measure];
  return {
    living: `The smallest living room of the three (${v})`,
    kitchen: `The smallest kitchen (${v})`,
    open: `The least open living space (${v})`,
    primary: `The smallest main bedroom (${v})`,
    bedrooms: `Smaller other bedrooms (${v} each on average)`,
    halls: `More floor goes to halls and stairs (${pct})`,
  }[c.measure];
}
