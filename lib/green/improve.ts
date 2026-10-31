import type { Layout, Shell } from "../layout/schema.ts";
import { furnish } from "../three/furniture.ts";
import { greenery, type GreenChoices } from "./score.ts";
import { CARE_SCORE, lightFit, PLANTS, type Plant } from "./plants.ts";

// Ways to raise the greenery score, each a change the client can tick (and untick): more plants in a room, a
// plant that suits a room's light, a new kind of plant, planting along the garden edge. Each shows how many points
// it adds, worked out by applying it and scoring again; ticked, it changes the design (the 3D places the plants).

export type Change = { kind: "plants"; room: string; n: number } | { kind: "swap"; room: string; plant: string } | { kind: "outdoor" };
export type Fix = { id: string; label: string; gain: number; change: Change };
/** Saved on the project: the changes ticked, in order, with their labels. */
export type Ticked = { id: string; label: string; change: Change }[];
type Input = { layout: Layout; briefPlants: { name: string }[]; lot?: Shell | null; lush: boolean };

/** The design choices that a list of ticked changes adds up to. */
export function choicesOf(ticked: Ticked): GreenChoices {
  const c: Required<GreenChoices> = { extra: {}, swap: {}, outdoor: false };
  for (const { change: x } of ticked) {
    if (x.kind === "plants") c.extra[x.room] = (c.extra[x.room] ?? 0) + x.n;
    else if (x.kind === "swap") c.swap[x.room] = x.plant;
    else c.outdoor = true;
  }
  return c;
}

export const scoreWith = ({ layout, briefPlants, lot, lush }: Input, c: GreenChoices) =>
  greenery(layout, furnish(layout, { lush, extraPlants: c.extra }), briefPlants, lot, c);

const NEED = ["low", "medium", "bright"];
const best = (light: Plant["light"], not: Set<string> = new Set()) =>
  [...PLANTS].filter((p) => lightFit(p, light) === 1 && !not.has(p.name)).sort((a, b) => CARE_SCORE[b.care] - CARE_SCORE[a.care])[0];

/** The changes still open after `ticked`, biggest gain first. Only changes that raise the score are offered. */
export function fixes(input: Input, ticked: Ticked): Fix[] {
  const current = choicesOf(ticked);
  const now = scoreWith(input, current);
  const out: Omit<Fix, "gain">[] = [];
  for (const r of now.rooms) {
    // As many plants as the room still needs and has free spots for (floor first, then wall shelves).
    const need = Math.ceil(r.area / 8) - r.plants;
    if (need > 0) {
      const extra = current.extra?.[r.id] ?? 0;
      const placed = scoreWith(input, { ...current, extra: { ...current.extra, [r.id]: extra + need } }).rooms.find((x) => x.id === r.id)!.plants;
      const n = placed - r.plants;
      if (n > 0) out.push({ id: `plants-${r.id}-${extra}`, label: `Add ${n === 1 ? "a plant" : `${n} plants`} to the ${r.name.toLowerCase()}`, change: { kind: "plants", room: r.id, n } });
    }
    // A plant that suits the room's light and is easy to keep.
    if (r.pick && (lightFit(r.pick, r.light) < 1 || r.pick.care !== "easy")) {
      const p = best(r.light);
      if (p && p.name !== r.pick.name)
        out.push({ id: `swap-${r.id}-${p.name}`, label: `Put a ${p.name.toLowerCase()} in the ${r.name.toLowerCase()}: it suits ${r.light} light and is easy to keep`, change: { kind: "swap", room: r.id, plant: p.name } });
    }
  }
  // A new kind, in the brightest room that has no swap yet, so it never replaces the last one added.
  if (now.species.length < 4) {
    const room = now.rooms.filter((r) => !current.swap?.[r.id]).sort((a, b) => NEED.indexOf(b.light) - NEED.indexOf(a.light))[0];
    const p = room && best(room.light, new Set(now.species));
    if (room && p) out.push({ id: `kind-${room.id}-${p.name}`, label: `Add a new kind of plant: a ${p.name.toLowerCase()} in the ${room.name.toLowerCase()}`, change: { kind: "swap", room: room.id, plant: p.name } });
  }
  if (now.garden && !current.outdoor && now.garden.share < 0.5)
    out.push({ id: "outdoor", label: "Plant the garden edge: planters and a climber along the boundary", change: { kind: "outdoor" } });
  return out
    // Exact gains: a change worth half a point is still worth offering.
    .map((f) => ({ ...f, gain: scoreWith(input, choicesOf([...ticked, f])).exact - now.exact }))
    .filter((f) => f.gain > 0.05)
    .sort((a, b) => b.gain - a.gain);
}

/** Every change at once: the best open change, again and again, until none is left (so two never clash). */
export function addAll(input: Input, ticked: Ticked, max = 40): Ticked {
  let out = ticked;
  for (let i = 0; i < max; i++) {
    const next = fixes(input, out)[0];
    if (!next) break;
    out = [...out, { id: next.id, label: next.label, change: next.change }];
  }
  return out;
}
