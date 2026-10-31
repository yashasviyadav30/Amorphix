import type { Floor, Layout, Opening, Rect, Space } from "./schema.ts";

const EPS = 1e-6;

// Smallest allowed side of a space, in metres.
// A bedroom needs a bed (2 m long) plus the swing of its door, so 2.6 m is its narrowest usable side.
// A living room needs a sofa facing a TV across a coffee table (3 m); a dining room a table with chairs both sides.
const MIN_SIDE: Record<string, number> = { bath: 1.5, corridor: 0.9, stairs: 0.9, storage: 1.2, bedroom: 2.6, "guest-room": 2.6, living: 3.0, lounge: 3.0, dining: 2.6 };
// Smallest usable floor area, in m², for rooms people sleep in.
const MIN_AREA: Record<string, number> = { bedroom: 7, "guest-room": 7 };
const minSide = (kind: string) => MIN_SIDE[kind] ?? 2.1;

// Rooms that don't need a window.
const NO_WINDOW = new Set(["bath", "storage", "corridor", "stairs", "closet", "server", "void", "pantry"]);

const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

// Does the segment of an opening lie on one edge of this rect?
function onEdge(o: Opening, r: Rect): boolean {
  const lo = (o.axis === "x" ? o.x : o.y) - o.width / 2;
  const hi = lo + o.width;
  if (o.axis === "x") {
    const onLine = Math.abs(o.y - r.y) < EPS || Math.abs(o.y - (r.y + r.h)) < EPS;
    return onLine && lo >= r.x - EPS && hi <= r.x + r.w + EPS;
  }
  const onLine = Math.abs(o.x - r.x) < EPS || Math.abs(o.x - (r.x + r.w)) < EPS;
  return onLine && lo >= r.y - EPS && hi <= r.y + r.h + EPS;
}

function checkFloor(layout: Layout, floor: Floor, errors: string[]) {
  const { width, depth } = layout.shell;
  const shell: Rect = { x: 0, y: 0, w: width, h: depth };
  const byId = new Map<string, Space>(floor.spaces.map((s) => [s.id, s]));
  const at = `floor ${floor.level}`;

  for (const s of floor.spaces) {
    const r = s.rect;
    if (r.x < -EPS || r.y < -EPS || r.x + r.w > width + EPS || r.y + r.h > depth + EPS)
      errors.push(`${at}: ${s.id} is outside the shell`);
    if (s.kind !== "void" && Math.min(r.w, r.h) < minSide(s.kind) - EPS)
      errors.push(`${at}: ${s.id} is narrower than ${minSide(s.kind)} m`);
    if (r.w * r.h < (MIN_AREA[s.kind] ?? 0) - EPS) errors.push(`${at}: ${s.id} is smaller than ${MIN_AREA[s.kind]} m²`);
  }

  for (let i = 0; i < floor.spaces.length; i++)
    for (let j = i + 1; j < floor.spaces.length; j++)
      if (overlapArea(floor.spaces[i].rect, floor.spaces[j].rect) > EPS)
        errors.push(`${at}: ${floor.spaces[i].id} overlaps ${floor.spaces[j].id}`);

  // Rooms must fill the floor: a gap is a hole in the building with no walls around it.
  const covered = floor.spaces.reduce((t, s) => t + s.rect.w * s.rect.h, 0);
  if (Math.abs(covered - width * depth) > 1e-3) errors.push(`${at}: rooms cover ${covered.toFixed(1)} of ${(width * depth).toFixed(1)} m², leaving a hole`);

  for (const o of floor.openings) {
    for (const id of o.between) {
      const r = id === "outside" ? shell : byId.get(id)?.rect;
      if (!r) errors.push(`${at}: ${o.id} joins unknown space ${id}`);
      else if (!onEdge(o, r)) errors.push(`${at}: ${o.id} is not on a wall of ${id}`);
    }
  }

  // Stairs are reached from a hall or landing; a room whose only door opens into the stairs can't be used.
  for (const o of floor.openings) {
    if (o.type !== "door") continue;
    const [a, b] = o.between.map((id) => byId.get(id));
    if (!a || !b) continue;
    const stairsTo = a.kind === "stairs" ? b : b.kind === "stairs" ? a : null;
    if (stairsTo && stairsTo.zone !== "circulation") errors.push(`${at}: ${stairsTo.id} opens into the stairs`);
  }

  // The front door opens into a hall or a living space, never a kitchen, bath or bedroom.
  const entry = floor.openings.find((o) => o.id === "door-entry");
  const into = entry && byId.get(entry.between.find((id) => id !== "outside") ?? "");
  if (into && ["kitchen", "bath", "bedroom", "guest-room", "laundry", "storage"].includes(into.kind)) errors.push(`${at}: the front door opens into the ${into.kind}`);

  // Nobody reaches a bedroom, bath or office through the kitchen.
  const PRIVATE = new Set(["bedroom", "guest-room", "bath", "office"]);
  for (const o of floor.openings) {
    if (o.type !== "door") continue;
    const [a, b] = o.between.map((id) => byId.get(id));
    if (a && b && ((PRIVATE.has(a.kind) && b.kind === "kitchen") || (PRIVATE.has(b.kind) && a.kind === "kitchen")))
      errors.push(`${at}: ${PRIVATE.has(a.kind) ? a.id : b.id} opens off the kitchen`);
  }

  // Two openings can't share the same stretch of wall: a window over the front door is no door at all.
  for (let i = 0; i < floor.openings.length; i++)
    for (let j = i + 1; j < floor.openings.length; j++) {
      const a = floor.openings[i];
      const b = floor.openings[j];
      if (a.axis !== b.axis) continue;
      const line = (o: Opening) => (o.axis === "x" ? o.y : o.x);
      const along = (o: Opening) => (o.axis === "x" ? o.x : o.y);
      if (Math.abs(line(a) - line(b)) > EPS) continue;
      if (Math.abs(along(a) - along(b)) * 2 < a.width + b.width - EPS) errors.push(`${at}: ${a.id} and ${b.id} overlap on the same wall`);
    }

  for (const s of floor.spaces)
    if (!NO_WINDOW.has(s.kind) && !floor.openings.some((o) => o.type === "window" && o.between.includes(s.id)))
      errors.push(`${at}: ${s.id} has no window`);

  // Every space must be reachable through doors: from the street on the ground floor, from the stairs above it.
  const start = floor.level === 0 ? "outside" : floor.spaces.find((s) => s.kind === "stairs")?.id;
  if (!start) {
    errors.push(`${at}: no stairs reach this floor`);
    return;
  }
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const here = queue.shift()!;
    for (const o of floor.openings)
      if (o.type === "door" && o.between.includes(here)) {
        const next = o.between[0] === here ? o.between[1] : o.between[0];
        if (!seen.has(next)) seen.add(next), queue.push(next);
      }
  }
  // "void" is wall thickness a reading left between rooms: part of the floor, but nobody goes there.
  for (const s of floor.spaces) if (s.kind !== "void" && !seen.has(s.id)) errors.push(`${at}: ${s.id} can't be reached`);
}

export function validate(layout: Layout): string[] {
  const errors: string[] = [];
  for (const floor of layout.floors) checkFloor(layout, floor, errors);
  if (layout.floors.length > 1) {
    const stairs = layout.floors.map((f) => f.spaces.find((s) => s.kind === "stairs")?.rect);
    const [a, b] = stairs;
    const same = (p: number, q: number) => Math.abs(p - q) < EPS;
    if (!a || !b || !same(a.x, b.x) || !same(a.y, b.y) || !same(a.w, b.w) || !same(a.h, b.h))
      errors.push("stairs don't line up between floors");
  }
  return errors;
}
