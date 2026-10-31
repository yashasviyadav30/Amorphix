import type { Layout } from "../layout/schema.ts";
import type { Estimate } from "../budget/costs.ts";
import type { Timeline } from "../budget/timeline.ts";

// The building site's starting plan, from the approved design: phases with dates from the design's timeline, and
// the main materials with quantities taken off the plan and unit costs from the budget. The builder can change
// all of it; this is only where they start. Pure, so it can be tested.

export type SeedPhase = { key: string; name: string; note: string; position: number; start: string; end: string };
export type SeedMaterial = { name: string; unit: string; needed: number; unitCost: number; phase: string };

const day = 86_400_000;
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** The calendar day in a time zone (the browser sends its own), so "today" on the server matches the person's day. */
export function dayIn(tz: string | undefined, d = new Date()) {
  try {
    return tz ? new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d) : isoDay(d);
  } catch {
    return isoDay(d);
  }
}

/** The site's phases: everything after design, shifted so the first one starts on `start`. The walk-round, fixes and
 *  keys are Move in's (snags, the pack, the client's acceptance), so the site ends when the building is done. */
export function seedPhases(t: Timeline, start: Date): SeedPhase[] {
  const site = t.phases.filter((p) => p.id !== "design" && p.id !== "handover");
  const offset = Math.min(...site.map((p) => p.start));
  return site.map((p, i) => {
    const from = new Date(start.getTime() + (p.start - offset) * 7 * day);
    return { key: p.id, name: p.name, note: p.note, position: i, start: isoDay(from), end: isoDay(new Date(from.getTime() + (p.weeks * 7 - 1) * day)) };
  });
}

const WALL = 2.8; // metres of wall height that gets paint or tile
const round = (n: number, to = 1) => Math.max(0, Math.round(n / to) * to);

/** The main materials and how much of each, from the rooms in the plan. */
export function seedMaterials(layout: Layout, est: Estimate, newBuild: boolean, units: "imperial" | "metric" = "metric"): SeedMaterial[] {
  const spaces = layout.floors.flatMap((f) => f.spaces).filter((s) => s.kind !== "void" && s.kind !== "stairs");
  const area = spaces.reduce((a, s) => a + s.rect.w * s.rect.h, 0);
  const walls = spaces.reduce((a, s) => a + 2 * (s.rect.w + s.rect.h) * WALL, 0);
  const wet = spaces.filter((s) => s.kind === "bath" || s.kind === "kitchen");
  const wetArea = wet.reduce((a, s) => a + s.rect.w * s.rect.h + 2 * (s.rect.w + s.rect.h) * 1.2, 0);
  const baths = spaces.filter((s) => s.kind === "bath").length;
  const kitchens = spaces.filter((s) => s.kind === "kitchen").length;
  const rooms = spaces.filter((s) => s.zone !== "circulation");
  const c = est.byCategory;
  const each = (total: number | undefined, qty: number) => (qty > 0 && total ? Math.round(total / qty) : 0);

  const out: SeedMaterial[] = [];
  const add = (name: string, unit: string, needed: number, unitCost: number, phase: string) => needed > 0 && out.push({ name, unit, needed, unitCost, phase });
  if (newBuild) {
    // Typical take-offs per m2 of floor for a framed building: about 4 bags of cement and 40 kg of steel.
    add("Cement", "bags", round(area * 4.3), each((c.construction ?? 0) * 0.15, round(area * 4.3)), "structure");
    add("Steel (rebar)", "kg", round(area * 40, 10), each((c.construction ?? 0) * 0.2, round(area * 40, 10)), "structure");
  }
  add("Flooring", "m²", round(area * 1.08), each((c.finishes ?? 0) * 0.6, round(area * 1.08)), "finishes");
  add("Wall paint", "m²", round(walls), each((c.finishes ?? 0) * 0.4, round(walls)), "finishes");
  add("Wall and floor tiles", "m²", round(wetArea * 1.1), each((c.bath ?? 0) * 0.25, round(wetArea * 1.1)), "joinery");
  add("Electrical points", "points", rooms.length * 6, each(c.electrical, rooms.length * 6), "services");
  add("Plumbing points", "points", baths * 4 + kitchens * 2, 0, "services");
  add("Kitchen units", "sets", kitchens, each(c.kitchen, kitchens), "joinery");
  add("Bathroom fittings", "sets", baths, each((c.bath ?? 0) * 0.75, baths), "joinery");
  add("Furniture pieces", "pieces", rooms.length * 3, each(c.furniture, rooms.length * 3), "furniture");
  add("Plants", "plants", rooms.length * 2, each(c.plants, rooms.length * 2), "plants");
  return units === "imperial" ? out.map(toImperial) : out;
}

const PER: Record<string, [string, number]> = { "m²": ["sq ft", 10.7639], kg: ["lb", 2.20462] };
/** A US site orders in sq ft and pounds: the same material, its quantity and unit price in those units. */
export function toImperial(m: SeedMaterial): SeedMaterial {
  const per = PER[m.unit];
  if (!per) return m;
  const [unit, f] = per;
  return { ...m, unit, needed: Math.round(m.needed * f), unitCost: Math.round((m.unitCost / f) * 100) / 100 };
}
