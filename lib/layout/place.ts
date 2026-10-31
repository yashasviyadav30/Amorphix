import type { Floor, Layout, Opening, Program, ProgramRoom, Shell, Space } from "./schema.ts";

// Double-loaded corridor: a hall runs the full width of the shell, rooms sit on both sides of it,
// so every room opens onto the hall and keeps one outside wall for its window.
// ponytail: rectangles in a rectangular shell; add L-shapes and courtyards when the shape editor lands.

export const HALL = 1.2; // corridor depth, m
// Stairwell length along the hall: two flights of 8 treads (22.5 cm) plus a 90 cm landing at each end.
export const STAIR_RUN = 3.6;
// When the front strip is deep enough, the stair turns to run front to back and the stairwell along the hall
// only needs the width of two flights.
export const stairWidth = (front: number) => (front >= STAIR_RUN ? 2.6 : STAIR_RUN);
export const DOOR = 0.9;
export const ENTRY = 1.0;
const MIN_STRIP = 2.4;

const MIN: Record<string, number> = { bath: 1.5, storage: 1.2, bedroom: 2.6, "guest-room": 2.6, living: 3.0, lounge: 3.0, dining: 2.6 };
const minSide = (kind: string) => MIN[kind] ?? 2.1;
const NO_WINDOW = new Set(["storage", "closet", "server"]);

export type Variant = { publicSide: "front" | "back"; mirror: boolean; serviceWithPublic: boolean };

export const VARIANTS: Variant[] = [
  { publicSide: "front", mirror: false, serviceWithPublic: false },
  { publicSide: "back", mirror: false, serviceWithPublic: false },
  { publicSide: "front", mirror: true, serviceWithPublic: true },
];

const sum = (rooms: ProgramRoom[]) => rooms.reduce((t, r) => t + r.area, 0);

// Split a strip of the given length among rooms in proportion to area, keeping every room at least its minimum width.
export function widths(rooms: ProgramRoom[], length: number): number[] {
  const min = rooms.map((r) => minSide(r.kind));
  if (min.reduce((a, b) => a + b, 0) > length + 1e-9)
    throw new Error(`${rooms.length} rooms don't fit along ${length.toFixed(1)} m`);
  const fixed = new Set<number>();
  for (;;) {
    const free = rooms.filter((_, i) => !fixed.has(i));
    const left = length - [...fixed].reduce((t, i) => t + min[i], 0);
    const scale = left / sum(free);
    const w = rooms.map((r, i) => (fixed.has(i) ? min[i] : r.area * scale));
    const short = w.findIndex((x, i) => !fixed.has(i) && x < min[i] - 1e-9);
    if (short === -1) return w;
    fixed.add(short);
  }
}

function sides(rooms: ProgramRoom[], v: Variant): [ProgramRoom[], ProgramRoom[]] {
  const pub = rooms.filter((r) => r.zone === "public");
  const priv = rooms.filter((r) => r.zone === "private");
  for (const r of rooms.filter((r) => r.zone === "service")) {
    if (v.serviceWithPublic || sum(pub) <= sum(priv)) pub.push(r);
    else priv.push(r);
  }
  // A hall with rooms on one side only wastes the other strip; move the smallest room across.
  if (!pub.length) pub.push(...priv.splice(0, Math.ceil(priv.length / 2)));
  if (!priv.length) priv.push(...pub.splice(Math.floor(pub.length / 2)));
  // Keep each side between 30% and 70% of the floor area, or a lone room stretches the length of the hall.
  // Service rooms move first, then the smallest room.
  const total = sum(rooms);
  for (let guard = 0; guard < rooms.length; guard++) {
    const [big, small] = sum(pub) > sum(priv) ? [pub, priv] : [priv, pub];
    if (sum(big) <= total * 0.7 || big.length < 2) break;
    const pick = [...big].sort((a, b) => (a.zone === "service" ? 0 : 1) - (b.zone === "service" ? 0 : 1) || a.area - b.area)[0];
    if (sum(small) + pick.area > total * 0.7) break;
    big.splice(big.indexOf(pick), 1);
    small.push(pick);
  }
  return [pub, priv];
}

// Depth of the front strip. Every floor shares it, so the hall and stairs stack.
export function frontDepth(rooms: ProgramRoom[], D: number, v: Variant): number {
  const room = D - HALL;
  if (room < 2 * MIN_STRIP) throw new Error(`a ${D.toFixed(1)} m deep shell is too shallow for rooms on both sides`);
  const [pub, priv] = sides(rooms, v);
  const frontRooms = v.publicSide === "front" ? pub : priv;
  // Each side gets 40-60% of the depth: an extra-deep strip turns small rooms into slivers.
  const lo = Math.max(MIN_STRIP, room * 0.4);
  const hi = Math.min(room - MIN_STRIP, room * 0.6);
  return Math.min(Math.max((room * sum(frontRooms)) / sum(rooms), lo), hi);
}

export function placeFloor(level: number, rooms: ProgramRoom[], shell: Shell, stairs: boolean, v: Variant, front: number): Floor {
  const { width: W, depth: D } = shell;
  const [pub, priv] = sides(rooms, v);
  const [frontRooms, backRooms] = v.publicSide === "front" ? [pub, priv] : [priv, pub];
  // The front strip shares its length with the stairwell. If its rooms can't fit, move rooms to the back
  // strip, service rooms first, then the smallest, while the back strip still has room for them.
  const need = (list: ProgramRoom[]) => list.reduce((t, r) => t + minSide(r.kind), 0);
  const sw = stairWidth(front);
  const frontLength = W - (stairs ? sw : 0);
  while (need(frontRooms) > frontLength + 1e-9 && frontRooms.length > 1) {
    const pick = [...frontRooms].sort((a, b) => (a.zone === "service" ? 0 : 1) - (b.zone === "service" ? 0 : 1) || a.area - b.area)[0];
    if (need(backRooms) + minSide(pick.kind) > W + 1e-9) break;
    frontRooms.splice(frontRooms.indexOf(pick), 1);
    backRooms.push(pick);
  }
  const hallY = front;
  const backY = front + HALL;

  // The hall runs the full length, so every room opens straight onto it. The stairs sit in their own
  // stairwell (a turning stair with a landing) at the far end of the front strip, entered from the hall,
  // so no room ever opens into the stairs. The entrance is at the other end of the hall.
  const entryAtLeft = !v.mirror;
  const hall: Space = { id: "hall", name: "Hall", kind: "corridor", zone: "circulation", rect: { x: 0, y: hallY, w: W, h: HALL } };
  const spaces: Space[] = [hall];
  const well = stairs ? { x: entryAtLeft ? W - sw : 0, y: 0, w: sw, h: front } : null;
  if (well) spaces.push({ id: "stairs", name: "Stairs", kind: "stairs", zone: "circulation", rect: well });

  const openings: Opening[] = [];
  const strip = (list: ProgramRoom[], x0: number, length: number, y: number, h: number, isFront: boolean) => {
    const ordered = v.mirror ? [...list].reverse() : [...list];
    const ws = widths(ordered, length);
    let x = x0;
    ordered.forEach((r, i) => {
      const w = ws[i];
      spaces.push({ id: r.id, name: r.name, kind: r.kind, zone: r.zone, rect: { x, y, w, h } });
      // Doors sit near the corner on the side you arrive from, as an architect would place them, so the
      // rest of the wall is free for a bed, a sofa or a desk.
      const dw = Math.min(DOOR, w - 0.2);
      const dx = entryAtLeft ? x + 0.1 + dw / 2 : x + w - 0.1 - dw / 2;
      openings.push({ id: `door-${r.id}`, type: "door", between: [r.id, "hall"], x: dx, y: isFront ? y + h : y, axis: "x", width: dw });
      if (!NO_WINDOW.has(r.kind)) {
        // A living room's window sits toward one end, leaving a clear stretch of wall for the TV.
        const living = r.kind === "living" || r.kind === "lounge";
        const win = r.kind === "bath" ? 0.6 : Math.min(w * (living ? 0.4 : 0.5), 2.4);
        const wx = living ? x + w * 0.3 : x + w / 2;
        openings.push({ id: `win-${r.id}`, type: "window", between: [r.id, "outside"], x: wx, y: isFront ? 0 : D, axis: "x", width: win });
      }
      x += w;
    });
  };
  strip(frontRooms, well && !entryAtLeft ? sw : 0, W - (well ? sw : 0), 0, front, true);
  strip(backRooms, 0, W, backY, D - backY, false);

  // The stairwell door sits at its inner end, by the foot of the first flight.
  if (well)
    openings.push({ id: "door-stairs", type: "door", between: ["stairs", "hall"], x: entryAtLeft ? well.x + 0.1 + DOOR / 2 : well.x + sw - 0.1 - DOOR / 2, y: hallY, axis: "x", width: DOOR });
  if (level === 0)
    openings.push({ id: "door-entry", type: "door", between: ["hall", "outside"], x: entryAtLeft ? 0 : W, y: hallY + HALL / 2, axis: "y", width: ENTRY });

  return { level, spaces, openings };
}

// Swap x and y: used to lay a deep shell out sideways so the hall runs along its long side.
export function transpose(layout: Layout, shell: Shell): Layout {
  return {
    ...layout,
    shell,
    floors: layout.floors.map((f) => ({
      ...f,
      spaces: f.spaces.map((s) => ({ ...s, rect: { x: s.rect.y, y: s.rect.x, w: s.rect.h, h: s.rect.w } })),
      openings: f.openings.map((o) => ({ ...o, x: o.y, y: o.x, axis: o.axis === "x" ? ("y" as const) : ("x" as const) })),
    })),
  };
}

export function place(program: Program, shell: Shell, variant: Variant = VARIANTS[0]): Layout {
  // The hall runs along the longer side, so rooms keep sensible proportions on deep lots.
  if (shell.depth > shell.width) return transpose(placeAlong(program, { width: shell.depth, depth: shell.width }, variant), shell);
  return placeAlong(program, shell, variant);
}

function placeAlong(program: Program, shell: Shell, variant: Variant): Layout {
  const stairs = program.floors > 1;
  const front = frontDepth(program.rooms.filter((r) => r.floor === 0), shell.depth, variant);
  const floors = Array.from({ length: program.floors }, (_, level) => {
    const rooms = program.rooms.filter((r) => r.floor === level);
    if (!rooms.length) throw new Error(`floor ${level} has no rooms`);
    return placeFloor(level, rooms, shell, stairs, variant, front);
  });
  return { spaceType: program.spaceType, shell, floors };
}

// The three plan options the wizard shows side by side.
export const planOptions = (program: Program, shell: Shell) => VARIANTS.map((v) => place(program, shell, v));
