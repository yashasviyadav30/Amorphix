import type { Floor, Layout, Opening, Space } from "../layout/schema.ts";
import { wallPieces, type Piece } from "../layout/walls.ts";

// Turns a 2D layout into 3D building parts. Plan x stays x; plan y becomes z; y is up. Metres throughout.
export const STOREY = 3.1; // floor-to-floor height
export const WALL_H = 2.8;
export const DOOR_H = 2.1;
export const SILL = 0.9;
export const EYE = 1.6;
const EXT = 0.2; // exterior wall thickness
const INT = 0.1; // interior wall thickness
const EPS = 1e-6;

// Openings that cut a solid wall piece: plan axis "x" openings lie on edges running along x.
const cuts = (run: Piece, openings: Opening[]) =>
  openings
    .map((o) => ({ o, at: o.axis === "x" ? o.y : o.x, c: o.axis === "x" ? o.x : o.y, axis: o.axis === "x" ? "x" : "z" }))
    .filter(({ axis, at, c, o }) => axis === run.axis && Math.abs(at - run.at) < 1e-4 && c - o.width / 2 >= run.from - EPS && c + o.width / 2 <= run.to + EPS)
    .sort((p, q) => p.c - q.c);

// One box of wall: a run along x or z, between two heights.
export type WallBox = { axis: "x" | "z"; at: number; from: number; to: number; y0: number; y1: number; thick: number; exterior: boolean; level: number };
export type Glass = { axis: "x" | "z"; at: number; from: number; to: number; y0: number; y1: number; level: number };
export type Slab = { id: string; kind: string; zone: string; x: number; z: number; w: number; d: number; y: number; level: number };

export function buildWalls(layout: Layout): { walls: WallBox[]; glass: Glass[] } {
  const walls: WallBox[] = [];
  const glass: Glass[] = [];
  for (const floor of layout.floors) {
    const base = floor.level * STOREY;
    // Open-plan stretches (living, dining, kitchen, hall) get no wall at all.
    for (const run of wallPieces(floor, layout.shell).filter((p) => !p.open)) {
      const exterior = run.exterior;
      const thick = exterior ? EXT : INT;
      const box = (from: number, to: number, y0: number, y1: number) =>
        to - from > EPS && walls.push({ axis: run.axis, at: run.at, from, to, y0: base + y0, y1: base + y1, thick, exterior, level: floor.level });
      let cursor = run.from;
      for (const { o, c } of cuts(run, floor.openings)) {
        const a = c - o.width / 2;
        const b = c + o.width / 2;
        box(cursor, a, 0, WALL_H);
        if (o.type === "door") box(a, b, DOOR_H, WALL_H);
        else {
          box(a, b, 0, SILL);
          box(a, b, DOOR_H, WALL_H);
          glass.push({ axis: run.axis, at: run.at, from: a, to: b, y0: base + SILL, y1: base + DOOR_H, level: floor.level });
        }
        cursor = b;
      }
      box(cursor, run.to, 0, WALL_H);
    }
  }
  return { walls, glass };
}

export function buildSlabs(layout: Layout): Slab[] {
  return layout.floors.flatMap((f) =>
    f.spaces.map((s) => ({ id: s.id, kind: s.kind, zone: s.zone, x: s.rect.x, z: s.rect.y, w: s.rect.w, d: s.rect.h, y: f.level * STOREY, level: f.level })),
  );
}

export type Point = [number, number, number];

const centre = (s: Space): [number, number] => [s.rect.x + s.rect.w / 2, s.rect.y + s.rect.h / 2];

// A point just inside `space` from a door on its edge.
function inside(o: Opening, s: Space, by: number): [number, number] {
  if (o.axis === "x") return [o.x, o.y + (centre(s)[1] > o.y ? by : -by)];
  return [o.x + (centre(s)[0] > o.x ? by : -by), o.y];
}

// A first-person walk: from the street, through the front door, a step into every room and back, then upstairs.
// `path` is where the eye goes; `gaze` (same length) is what it looks at at each point: along the hall,
// and into each room from its doorway, so the view shows rooms and furniture rather than the next wall.
// `stops` are the doorway views where the camera slows to take each room in.
export type Walk = { path: Point[]; gaze: Point[]; stops: Point[] };

// Small utility rooms stay in the model but the walk skips them: it's a tour of the rooms people live in.
const SKIP = new Set(["bath", "storage", "closet", "laundry", "server"]);
export const onTour = (s: Space) => s.zone !== "circulation" && !(SKIP.has(s.kind) && s.rect.w * s.rect.h < 12);

export function walkPlan(layout: Layout): Walk {
  const path: Point[] = [];
  const gaze: (Point | null)[] = [];
  const stops: Point[] = [];
  // A point to walk to, and optionally what to look at there; without one, you look where you're going.
  const go = (p: Point, look: Point | null = null) => {
    path.push(p);
    gaze.push(look);
  };
  const floors = [...layout.floors].sort((a, b) => a.level - b.level);
  const ground = floors[0];
  const entry = ground?.openings.find((o) => o.id === "door-entry");
  if (!entry) return { path, gaze: [], stops };

  // The walk is a person's route: every step stays inside one room or passes through a door, so it never
  // goes through a wall. Rooms are rectangles, so any straight line between two points in one room stays in it.
  const walkFloor = (floor: Floor, startId: string, from: Point) => {
    const y = floor.level * STOREY + EYE;
    const byId = new Map(floor.spaces.map((s) => [s.id, s]));
    const doors = floor.openings.filter((o) => o.type === "door" && o.id !== "door-entry");
    const links = (id: string) =>
      doors.filter((o) => o.between.includes(id)).map((o) => ({ o, next: byId.get(o.between[0] === id ? o.between[1] : o.between[0]) })).filter((l): l is { o: Opening; next: Space } => !!l.next);
    const seen = new Set<string>([startId]);
    let here = from;
    const pt = (xz: [number, number]): Point => [xz[0], y, xz[1]];
    const dist = (o: Opening) => Math.hypot(o.x - here[0], o.y - here[2]);
    // Go into a room only if it's worth seeing, or it's a hall, or it leads somewhere new.
    const worth = (s: Space) => s.zone === "circulation" || onTour(s) || links(s.id).some((l) => !seen.has(l.next.id) && l.next.kind !== "stairs");
    const cross = (o: Opening, a: Space, b: Space) => {
      go(pt(inside(o, a, 0.6)));
      go(pt([o.x, o.y]));
      here = pt(inside(o, b, 0.6));
      go(here);
    };
    const visit = (space: Space) => {
      for (;;) {
        const next = links(space.id)
          .filter((l) => !seen.has(l.next.id) && l.next.kind !== "stairs" && worth(l.next))
          .sort((p, q) => dist(p.o) - dist(q.o))[0];
        if (!next) return;
        seen.add(next.next.id);
        cross(next.o, space, next.next);
        if (onTour(next.next)) {
          // Stop a step inside and look across the room, then carry on from the doorway.
          const depth = next.o.axis === "x" ? next.next.rect.h : next.next.rect.w;
          const view = pt(inside(next.o, next.next, Math.min(1.2, depth * 0.4)));
          const far = inside(next.o, next.next, depth - 0.3);
          go(view, [far[0], y - 0.35, far[1]]);
          stops.push(view);
          go(here);
        }
        visit(next.next);
        cross(next.o, next.next, space);
      }
    };
    const start = byId.get(startId)!;
    if (onTour(start)) {
      const c = centre(start);
      stops.push(here);
      go(here, [c[0], y - 0.35, c[1]]);
    }
    visit(start);
    return { here, byId, links };
  };

  // From the street, through the front door.
  const entryRoom = ground.spaces.find((s) => s.id === entry.between.find((id) => id !== "outside"))!;
  const out = inside(entry, entryRoom, -3);
  go([out[0], EYE, out[1]], [entry.x, EYE - 0.2, entry.y]);
  go([entry.x, EYE, entry.y]);
  const inDoor = inside(entry, entryRoom, 0.8);
  let at: Point = [inDoor[0], EYE, inDoor[1]];
  go(at);

  for (let i = 0; i < floors.length; i++) {
    const floor = floors[i];
    const startId = i === 0 ? entryRoom.id : floor.spaces.find((s) => s.kind === "stairs")?.id;
    if (!startId) break;
    const { here, byId, links } = walkFloor(floor, startId, at);
    at = here;
    const up = floors[i + 1];
    const stairs = floor.spaces.find((s) => s.kind === "stairs");
    if (!up || !stairs) break;
    // Back to the stairs by the shortest way through the doors, then up.
    // The floor walk always returns to the room it started in, so search from there.
    const back = new Map<string, { from: string; o: Opening } | null>([[startId, null]]);
    const queue = [startId];
    while (queue.length) {
      const id = queue.shift()!;
      if (id === stairs.id) break;
      for (const l of links(id)) if (!back.has(l.next.id)) back.set(l.next.id, { from: id, o: l.o }), queue.push(l.next.id);
    }
    const route: { from: string; to: string; o: Opening }[] = [];
    for (let id = stairs.id; back.get(id); id = back.get(id)!.from) route.unshift({ from: back.get(id)!.from, to: id, o: back.get(id)!.o });
    const y = floor.level * STOREY + EYE;
    for (const step of route) {
      const a = byId.get(step.from)!;
      const b = byId.get(step.to)!;
      const pre = inside(step.o, a, 0.6);
      const post = inside(step.o, b, 0.6);
      go([pre[0], y, pre[1]]);
      go([step.o.x, y, step.o.y]);
      go([post[0], y, post[1]]);
    }
    const climb = stairWalk(stairs.rect, floor.openings.find((o) => o.id === "door-stairs"), floor.level * STOREY);
    for (const p of climb) go(p);
    at = climb.at(-1)!;
  }

  // Without an explicit look, look toward where you're walking next, a little below eye level.
  const looks: Point[] = gaze.map((g, i) => {
    if (g) return g;
    for (let j = i + 1; j < path.length; j++) {
      const d = Math.hypot(path[j][0] - path[i][0], path[j][2] - path[i][2]);
      if (d > 0.3) return [path[j][0] + (path[j][0] - path[i][0]) / d, path[j][1] - 0.15, path[j][2] + (path[j][2] - path[i][2]) / d];
    }
    return [path[i][0], path[i][1] - 0.15, path[i][2] + 1];
  });
  return { path, gaze: looks, stops };
}

export const walkPath = (layout: Layout): Point[] => walkPlan(layout).path;

export type StepBox = { x: number; z: number; w: number; d: number; y: number; h: number };

const LANDING = 0.9;
const STEPS = 8; // per flight

/**
 * The stairwell's own frame: u runs along it from the door end, v runs across it from the hall side.
 * Returns the map from (u, v) to world (x, z), the run, the width and the width of one flight.
 */
function stairFrame(rect: { x: number; y: number; w: number; h: number }, door: Opening | undefined) {
  // The flights run along the stairwell's longer side. If that's along the hall, u starts at the door's end of
  // the stairwell; if it runs away from the hall, u starts at the hall wall. v starts on the door's side.
  const runAlongX = rect.w >= rect.h;
  const run = runAlongX ? rect.w : rect.h;
  const across = runAlongX ? rect.h : rect.w;
  const doorX = door ? door.x : rect.x;
  const doorZ = door ? door.y : rect.y + rect.h;
  const nearLowX = Math.abs(doorX - rect.x) < Math.abs(doorX - (rect.x + rect.w));
  const nearLowZ = Math.abs(doorZ - rect.y) < Math.abs(doorZ - (rect.y + rect.h));
  const at = (u: number, v: number): [number, number] => {
    const a = runAlongX ? (nearLowX ? u : run - u) : nearLowZ ? u : run - u;
    const b = runAlongX ? (nearLowZ ? v : across - v) : nearLowX ? v : across - v;
    return runAlongX ? [rect.x + a, rect.y + b] : [rect.x + b, rect.y + a];
  };
  return { at, run, across, flight: Math.min(1.1, across / 2) };
}

/**
 * A U-shaped stair in its stairwell. You step in from the hall at the door end, climb the first flight along
 * the hall side to a half landing at the far end, turn, climb the second flight back, and arrive on a top
 * landing at the door end, by the stairwell door on the floor above. Each box is solid from y up by h.
 */
export function stairBoxes(rect: { x: number; y: number; w: number; h: number }, door: Opening | undefined, storey = STOREY): StepBox[] {
  const { at, run, across, flight } = stairFrame(rect, door);
  const rise = storey / (2 * STEPS + 1);
  const tread = (run - 2 * LANDING) / STEPS;
  const box = (u0: number, u1: number, v0: number, v1: number, y: number, h: number): StepBox => {
    const [x0, z0] = at(u0, v0);
    const [x1, z1] = at(u1, v1);
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0), d: Math.abs(z1 - z0), y, h };
  };
  const out: StepBox[] = [];
  for (let i = 0; i < STEPS; i++) out.push(box(LANDING + i * tread, LANDING + (i + 1) * tread, 0, flight, 0, (i + 1) * rise));
  out.push(box(run - LANDING, run, 0, across, 0, (STEPS + 1) * rise));
  for (let i = 0; i < STEPS; i++) out.push(box(run - LANDING - (i + 1) * tread, run - LANDING - i * tread, across - flight, across, 0, (STEPS + 2 + i) * rise));
  // The top landing is a slab at the upper floor's level, so the doorway below it keeps its headroom.
  out.push(box(0, LANDING, 0, across, storey - 0.2, 0.2));
  return out;
}

/** Where your eye goes walking up the stair: from the stairwell door below to the stairwell door above. */
export function stairWalk(rect: { x: number; y: number; w: number; h: number }, door: Opening | undefined, base: number, storey = STOREY): Point[] {
  const { at, run, across, flight } = stairFrame(rect, door);
  const rise = storey / (2 * STEPS + 1);
  const p = (u: number, v: number, y: number): Point => {
    const [x, z] = at(u, v);
    return [x, base + y + EYE, z];
  };
  const doorU = 0.55;
  const near = flight / 2;
  const far = across - flight / 2;
  return [
    p(doorU, 0.3, 0),
    p(LANDING, near, 0),
    p(run - LANDING, near, STEPS * rise),
    p(run - LANDING / 2, near, (STEPS + 1) * rise),
    p(run - LANDING / 2, far, (STEPS + 1) * rise),
    p(run - LANDING, far, (STEPS + 1) * rise),
    p(LANDING, far, storey),
    p(LANDING / 2, far, storey),
    p(doorU, 0.3, storey),
  ];
}
