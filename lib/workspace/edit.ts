import type { Floor, Layout, Program, ProgramRoom, Shell } from "../layout/schema.ts";
import { CONCEPT_IDS, placeConcept, type ConceptId } from "../layout/concepts.ts";
import { programOf } from "../plan-import/read.ts";
import { applyEdits, ZONES } from "../plan-import/edits.ts";
import { HOME_TYPES } from "../interview/living.ts";

// Changes to a chosen plan. The plan itself is the single source of truth: an edit reads the rooms back out of it,
// changes them, and lays them out again with the same concept, so every architect rule the engine and validator
// enforce still holds afterwards. Pure, so the browser can show the result at once while the server saves it.

export type Change =
  | { op: "resize"; room: string; by: number }
  | { op: "add"; kind: string; name: string }
  | { op: "remove"; room: string }
  | { op: "rename"; room: string; name: string }
  | { op: "kitchen"; open: boolean };

/** Rooms people can add, with a sensible size in m². */
export const ADDABLE: { kind: string; name: string; area: number }[] = [
  { kind: "office", name: "Study", area: 10 },
  { kind: "guest-room", name: "Guest room", area: 12 },
  { kind: "bedroom", name: "Bedroom", area: 12 },
  { kind: "bath", name: "Bathroom", area: 5 },
  { kind: "prayer", name: "Prayer room", area: 4 },
  { kind: "gym", name: "Gym", area: 12 },
  { kind: "media", name: "Media room", area: 14 },
  { kind: "storage", name: "Store room", area: 4 },
  { kind: "laundry", name: "Laundry", area: 5 },
  { kind: "meeting", name: "Meeting room", area: 12 },
];
const ZONE_OF: Record<string, ProgramRoom["zone"]> = { ...ZONES, prayer: "private", gym: "private", media: "public" };

/** Bigger is a quarter more room, smaller a fifth less: enough to see, never enough to break the plan. */
export const BIGGER = 1.25;
export const SMALLER = 0.8;

export type Edited = { layout: Layout } | { error: string };

const spaces = (l: Layout) => l.floors.flatMap((f) => f.spaces.map((s) => ({ ...s, level: f.level })));
const roomOf = (l: Layout, id: string) => spaces(l).find((s) => s.id === id && s.zone !== "circulation");

/** In words, for the history list and the toast: "Made the Kitchen bigger". */
export function describe(change: Change, before: Layout): string {
  const name = "room" in change ? (roomOf(before, change.room)?.name ?? "the room") : "";
  switch (change.op) {
    case "resize":
      return `Made the ${name} ${change.by > 1 ? "bigger" : "smaller"}`;
    case "add":
      return `Added a ${change.name.toLowerCase()}`;
    case "remove":
      return `Removed the ${name}`;
    case "rename":
      return `Renamed ${name} to ${change.name}`;
    case "kitchen":
      return change.open ? "Opened the kitchen to the living area" : "Gave the kitchen its own room";
  }
}

function changeProgram(program: Program, change: Change, layout: Layout): Program | string {
  const rooms = program.rooms;
  const find = (id: string) => rooms.find((r) => r.id === id);
  switch (change.op) {
    case "resize": {
      const r = find(change.room);
      if (!r) return "That room isn't in this plan.";
      const area = Math.min(80, Math.max(2, r.area * change.by));
      return { ...program, rooms: rooms.map((x) => (x.id === r.id ? { ...x, area } : x)) };
    }
    case "remove": {
      const r = find(change.room);
      if (!r) return "That room isn't in this plan.";
      if (rooms.length <= 2) return "A plan needs at least two rooms.";
      const home = HOME_TYPES.has(layout.spaceType);
      for (const kind of home ? ["kitchen", "bath"] : ["bath"])
        if (r.kind === kind && rooms.filter((x) => x.kind === kind).length === 1) return `This is the only ${kind === "bath" ? "bathroom" : kind}; every ${home ? "home" : "space"} needs one.`;
      return { ...program, rooms: rooms.filter((x) => x.id !== r.id) };
    }
    case "add": {
      const spec = ADDABLE.find((a) => a.kind === change.kind) ?? { kind: change.kind, name: change.name, area: 10 };
      const zone = ZONE_OF[spec.kind] ?? "private";
      // Upstairs in a two-storey house for private rooms, downstairs for the rest.
      const floor = program.floors > 1 && zone === "private" ? 1 : 0;
      let n = 1;
      while (find(`${spec.kind}-${n}`)) n++;
      const same = rooms.filter((r) => r.name.toLowerCase().startsWith(change.name.toLowerCase())).length;
      const name = same ? `${change.name} ${same + 1}` : change.name;
      return { ...program, rooms: [...rooms, { id: `${spec.kind}-${n}`, name, kind: spec.kind, area: spec.area, zone, floor }] };
    }
    default:
      return program;
  }
}

/** Prefer arrangements that keep each floor close to how it was; the room being changed is free to move. */
const keepClose = (before: Layout, except?: string) => (floor: Floor) => {
  const was = before.floors.find((f) => f.level === floor.level);
  return was ? floorUpheaval(was, floor, Math.max(before.shell.width, before.shell.depth), except) : 0;
};

/** Which band row each room is in now: the front row starts at the street (y = 0 in the engine's own frame). */
function rowsOf(layout: Layout): Record<string, "front" | "back"> {
  const deep = layout.shell.depth > layout.shell.width;
  const out: Record<string, "front" | "back"> = {};
  for (const s of spaces(layout)) out[s.id] = (deep ? s.rect.x : s.rect.y) < 0.3 ? "front" : "back";
  return out;
}

/**
 * The plan after one change, or a plain reason it can't be done. `lot`: the whole plot. The building is sized to its
 * rooms and the rest is garden, so a room that can't grow or fit inside lets the building grow a little into the
 * garden, as an architect would, before it's refused.
 */
export function applyChange(layout: Layout, change: Change, lot?: Shell | null): Edited {
  const out = applyWithin(layout, change);
  if (!("error" in out) || !lot?.width || !lot.depth || (change.op !== "resize" && change.op !== "add") || (change.op === "resize" && change.by < 1)) return out;
  for (const g of [1.08, 1.16, 1.25]) {
    const shell = { width: Math.min(lot.width, +(layout.shell.width * Math.sqrt(g)).toFixed(1)), depth: Math.min(lot.depth, +(layout.shell.depth * Math.sqrt(g)).toFixed(1)) };
    if (shell.width <= layout.shell.width && shell.depth <= layout.shell.depth) break;
    const grown = applyWithin({ ...layout, shell: { ...layout.shell, ...shell } }, change);
    if (!("error" in grown)) return grown;
  }
  return out;
}

function applyWithin(layout: Layout, change: Change): Edited {
  if (change.op === "rename") {
    const name = change.name.trim().slice(0, 40);
    if (!name) return { error: "Give the room a name." };
    if (!roomOf(layout, change.room)) return { error: "That room isn't in this plan." };
    const twin = spaces(layout).find((s) => s.id !== change.room && s.zone !== "circulation" && s.name.trim().toLowerCase() === name.toLowerCase());
    if (twin) return { error: `There's already a room called ${twin.name}. Pick another name.` };
    return { layout: applyEdits(layout, [{ id: change.room, name }]) };
  }
  const concept = layout.concept?.id as ConceptId | undefined;
  // A plan someone uploaded wasn't laid out by the engine, so only its names can change.
  if (!concept || !CONCEPT_IDS.includes(concept)) return { error: "This is your own uploaded plan, so its rooms can be renamed but not moved or resized here." };

  const kitchen = spaces(layout).find((s) => s.kind === "kitchen");
  let closedKitchen = kitchen?.open === false;
  if (change.op === "kitchen") {
    if (!kitchen) return { error: "This plan has no kitchen." };
    if (closedKitchen === !change.open) return { error: change.open ? "The kitchen is already open." : "The kitchen already has its own room." };
    closedKitchen = !change.open;
  }
  if (change.op === "resize") return resize(layout, change, concept, closedKitchen);
  if (change.op === "add") return add(layout, change, concept, closedKitchen);
  const program = changeProgram(programOf(layout), change, layout);
  if (typeof program === "string") return { error: program };
  const next = placeConcept(program, layout.shell, concept, { closedKitchen, prefer: keepClose(layout), rows: rowsOf(layout) });
  if (!next) {
    return { error: "That change doesn't fit this plan." };
  }
  return { layout: { ...next, concept: layout.concept } };
}

const areaOf = (l: Layout, id: string) => {
  const r = roomOf(l, id);
  return r ? r.rect.w * r.rect.h : 0;
};

/**
 * Bigger or smaller. The engine keeps the first arrangement that passes the rules, so a bigger target doesn't
 * always give a bigger room (an open band shares its width out in fixed steps). A few strengths of the change are
 * tried, some also easing the other rooms the other way, and the one whose room moves the right way by closest to
 * the asked amount wins. If none moves it, say so rather than return the same plan.
 */
function resize(layout: Layout, change: Extract<Change, { op: "resize" }>, concept: ConceptId, closedKitchen: boolean): Edited {
  const base = programOf(layout);
  const room = base.rooms.find((r) => r.id === change.room);
  if (!room) return { error: "That room isn't in this plan." };
  const before = areaOf(layout, room.id);
  const grow = change.by > 1;
  const tries: Program[] = [];
  for (const k of [1, 1.6, 2.4, 3.5]) {
    const by = Math.pow(change.by, k);
    // The room alone; the room with every other room easing back; the room with only its neighbours in the same
    // zone and floor easing back (an open band of living, dining and kitchen shares one width); the room with
    // every room on its floor giving way, which is what an architect does when the floor is full.
    for (const [others, mates] of [[1, "all"], [1 / Math.sqrt(by), "all"], [1 / by, "zone"], [1 / by, "floor"], [1 / (by * by), "floor"]] as const) {
      tries.push({
        ...base,
        rooms: base.rooms.map((r) =>
          r.id === room.id
            ? { ...r, area: Math.min(80, Math.max(2, r.area * by)) }
            : mates === "all" || (r.floor === room.floor && (mates === "floor" || r.zone === room.zone))
              ? { ...r, area: Math.max(2, r.area * others) }
              : r,
        ),
      });
    }
  }
  let best: { layout: Layout; miss: number } | null = null;
  for (const program of tries) {
    const next = placeConcept(program, layout.shell, concept, { closedKitchen, prefer: keepClose(layout, room.id), rows: rowsOf(layout) });
    if (!next) continue;
    const ratio = areaOf(next, room.id) / before;
    // It has to move the right way by at least 4%, so the change is visible.
    if (grow ? ratio < 1.04 : ratio > 0.96) continue;
    // Closest to the asked amount, and above all the least upheaval for every other room.
    const miss = Math.abs(Math.log(ratio / change.by)) + 3 * upheaval(layout, next, room.id);
    if (!best || miss < best.miss) best = { layout: next, miss };
  }
  if (!best) return { error: `The ${room.name.toLowerCase()} can't get ${grow ? "bigger" : "smaller"} in this layout without breaking it. Try ${grow ? "making a room next to it smaller" : "another room"} first.` };
  return { layout: { ...best.layout, concept: layout.concept } };
}

/**
 * How much a change disturbs the rooms it wasn't about: how far each moved (as a share of the building's size) and
 * how much its area changed, averaged. 0 means nothing else moved.
 */
export function upheaval(before: Layout, after: Layout, except?: string): number {
  const span = Math.max(before.shell.width, before.shell.depth);
  const scores = after.floors.map((f) => {
    const was = before.floors.find((b) => b.level === f.level);
    return was ? floorUpheaval(was, f, span, except) : 0;
  });
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

function floorUpheaval(before: Floor, after: Floor, span: number, except?: string): number {
  const old = new Map(before.spaces.map((s) => [s.id, s]));
  let total = 0;
  let n = 0;
  for (const s of after.spaces) {
    const o = old.get(s.id);
    if (!o || s.id === except || s.zone === "circulation") continue;
    const moved = Math.hypot(s.rect.x + s.rect.w / 2 - (o.rect.x + o.rect.w / 2), s.rect.y + s.rect.h / 2 - (o.rect.y + o.rect.h / 2)) / span;
    const grew = Math.abs(Math.log((s.rect.w * s.rect.h) / Math.max(0.1, o.rect.w * o.rect.h)));
    total += moved + grew;
    n++;
  }
  return n ? total / n : 0;
}

/**
 * A new room. Its area changes how much width the open band gets, which can ripple through every room, so a few
 * placements are tried (its usual zone or a nearby one, a little smaller, the other floor of a two-storey home) and
 * the one that disturbs the rest of the plan least wins, with a small cost for straying from the usual size and zone.
 */
function add(layout: Layout, change: Extract<Change, { op: "add" }>, concept: ConceptId, closedKitchen: boolean): Edited {
  const base = changeProgram(programOf(layout), change, layout);
  if (typeof base === "string") return { error: base };
  const added = base.rooms.at(-1)!;
  const zones = [...new Set([added.zone, ...(added.zone === "public" ? ["private"] : added.zone === "private" ? ["service", "public"] : ["private"])])] as ProgramRoom["zone"][];
  const floors = base.floors > 1 ? [added.floor, 1 - added.floor] : [added.floor];
  let best = null as { layout: Layout; score: number } | null;
  // First as the plan stands; only if nothing fits do the other rooms give up a little space for it.
  for (const others of [1, 0.9, 0.8]) {
    for (const zone of zones)
      for (const floor of floors)
        for (const k of [1, 0.8, 0.65]) {
          const rest = base.rooms.slice(0, -1).map((r) => (others < 1 && r.floor === floor ? { ...r, area: Math.max(2, r.area * others) } : r));
          const program = { ...base, rooms: [...rest, { ...added, zone, floor, area: added.area * k }] };
          const next = placeConcept(program, layout.shell, concept, { closedKitchen, prefer: keepClose(layout), rows: rowsOf(layout) });
          if (!next) continue;
          const score = upheaval(layout, next) + 0.3 * Math.abs(Math.log(k)) + (zone === added.zone ? 0 : 0.08) + (floor === added.floor ? 0 : 0.05);
          if (!best || score < best.score) best = { layout: next, score };
        }
    if (best) break;
  }
  if (!best) return { error: "There isn't room for that on this plot, even with the other rooms a little smaller. Try removing a room first." };
  return { layout: { ...best.layout, concept: layout.concept } };
}
