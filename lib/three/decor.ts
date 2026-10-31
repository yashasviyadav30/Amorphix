import type { Floor, Layout, Space } from "../layout/schema.ts";
import { wallPieces } from "../layout/walls.ts";
import { orient, type Item } from "./furniture.ts";
import { DOOR_H, SILL, STOREY, WALL_H } from "./geometry.ts";

// What hangs on and covers the walls: a feature wall behind the sofa or bed, framed art, a kitchen
// backsplash, bathroom tile, and curtains at the windows. Everything sits on solid wall only, so an
// open-plan side gets nothing and windows and doors stay clear.

const EPS = 1e-4;
const FEATURE = new Set(["living", "lounge", "bedroom", "guest-room", "dining", "office", "reception", "meeting"]);
const CURTAINS = new Set(["living", "lounge", "bedroom", "guest-room", "dining", "office"]);
const ART_SIDE = new Set(["living", "lounge", "dining", "bedroom", "guest-room"]);
// Rooms whose other walls get panelling below a rail (drawn only for a style that has it, see models.tsx).
const PANELLED = new Set(["living", "lounge", "dining", "bedroom", "guest-room", "office"]);
const RAIL = 0.92;

type Vec = [number, number];
/** A wall of a room as a line: start point, unit direction, length, and the way into the room. */
type Line = { p0: Vec; e: Vec; len: number; inward: Vec };
/** A stretch of solid wall along a line, from t0 to t1, between heights y0 and y1. */
export type Stretch = { t0: number; t1: number; y0: number; y1: number; exterior: boolean };

const axisOf = (e: Vec) => (e[0] !== 0 ? "x" : "z");

/** The solid stretches along one wall line, with gaps for doors and only sill and lintel at windows. */
export function stretches(floor: Floor, layout: Layout, line: Line): Stretch[] {
  const axis = axisOf(line.e);
  const at = axis === "x" ? line.p0[1] : line.p0[0];
  const along = (v: number) => (v - (axis === "x" ? line.p0[0] : line.p0[1])) * (axis === "x" ? line.e[0] : line.e[1]);
  const solid = wallPieces(floor, layout.shell)
    .filter((p) => !p.open && p.axis === axis && Math.abs(p.at - at) < EPS)
    .map((p) => {
      const [a, b] = [along(p.from), along(p.to)].sort((m, n) => m - n);
      return { t0: Math.max(0, a), t1: Math.min(line.len, b), exterior: p.exterior };
    })
    .filter((s) => s.t1 - s.t0 > EPS);
  // openings name the plan's axes (x and y), wall lines the 3D's (x and z): a "z" wall holds "y" openings
  const holes = floor.openings
    .filter((o) => o.axis === (axis === "x" ? "x" : "y") && Math.abs((axis === "x" ? o.y : o.x) - at) < EPS)
    .map((o) => {
      const c = along(axis === "x" ? o.x : o.y);
      return { t0: c - o.width / 2, t1: c + o.width / 2, window: o.type === "window" };
    })
    .sort((a, b) => a.t0 - b.t0);
  const out: Stretch[] = [];
  for (const s of solid) {
    let cursor = s.t0;
    for (const h of holes) {
      if (h.t1 <= s.t0 || h.t0 >= s.t1) continue;
      const a = Math.max(s.t0, h.t0);
      const b = Math.min(s.t1, h.t1);
      if (a - cursor > EPS) out.push({ t0: cursor, t1: a, y0: 0, y1: WALL_H, exterior: s.exterior });
      if (h.window) {
        out.push({ t0: a, t1: b, y0: 0, y1: SILL, exterior: s.exterior });
        out.push({ t0: a, t1: b, y0: DOOR_H, y1: WALL_H, exterior: s.exterior });
      }
      cursor = b;
    }
    if (s.t1 - cursor > EPS) out.push({ t0: cursor, t1: s.t1, y0: 0, y1: WALL_H, exterior: s.exterior });
  }
  return out;
}

/** The room's four walls as lines: back (facing the door), left, right and front, each looking into the room. */
export function roomLines(room: Space, floor: Floor): Record<"back" | "left" | "right" | "front", Line> {
  const door = floor.openings.find((o) => o.type === "door" && o.between[0] === room.id);
  const { origin, u, v, W, D } = orient(room, door);
  const at = (a: number, b: number): Vec => [origin[0] + u[0] * a + v[0] * b, origin[1] + u[1] * a + v[1] * b];
  const neg = (p: number[]): Vec => [-p[0], -p[1]];
  return {
    back: { p0: at(0, 0), e: u as Vec, len: W, inward: v as Vec },
    front: { p0: at(0, D), e: u as Vec, len: W, inward: neg(v) },
    left: { p0: at(0, 0), e: v as Vec, len: D, inward: u as Vec },
    right: { p0: at(W, 0), e: v as Vec, len: D, inward: neg(u) },
  };
}

/** An item lying flat on a wall line, from t0 to t1 along it, standing off the wall's face. */
function onWall(room: Space, level: number, line: Line, s: { t0: number; t1: number; y0: number; y1: number; exterior: boolean }, name: string, depth: number, role: Item["role"]): Item {
  const off = (s.exterior ? 0.1 : 0.05) + depth / 2 + 0.002;
  const t = (s.t0 + s.t1) / 2;
  const x = line.p0[0] + line.e[0] * t + line.inward[0] * off;
  const z = line.p0[1] + line.e[1] * t + line.inward[1] * off;
  const lw = s.t1 - s.t0;
  const alongX = axisOf(line.e) === "x";
  return {
    room: room.id, name, x, z, y: level * STOREY + s.y0, h: s.y1 - s.y0,
    w: alongX ? lw : depth, d: alongX ? depth : lw, lw, ld: depth,
    rot: Math.atan2(line.inward[0], line.inward[1]), role, level, kind: room.kind,
  };
}

/** The longest full-height stretch that covers point t (or any, if t is omitted), at least min long. */
function fullAt(list: Stretch[], min: number, t?: number) {
  return list
    .filter((s) => s.y0 === 0 && s.y1 === WALL_H && s.t1 - s.t0 >= min && (t === undefined || (s.t0 <= t && t <= s.t1)))
    .sort((a, b) => b.t1 - b.t0 - (a.t1 - a.t0))[0];
}

export function decorate(layout: Layout): Item[] {
  const items: Item[] = [];
  for (const floor of layout.floors) {
    for (const room of floor.spaces.filter((s) => s.zone !== "circulation")) {
      const lines = roomLines(room, floor);
      const walls = Object.fromEntries(Object.entries(lines).map(([k, l]) => [k, stretches(floor, layout, l)])) as Record<keyof typeof lines, Stretch[]>;
      const put = (side: keyof typeof lines, s: Stretch, name: string, depth: number, role: Item["role"]) => items.push(onWall(room, floor.level, lines[side], s, name, depth, role));
      const kind = room.kind;

      if (FEATURE.has(kind)) {
        for (const s of walls.back) put("back", s, "feature wall", 0.02, "accent");
        // A large piece of art centred over the sofa, bed or sideboard.
        const mid = lines.back.len / 2;
        const host = fullAt(walls.back, 1.4, mid);
        if (host) {
          const w = Math.min(1.4, (host.t1 - host.t0) * 0.45);
          const c = Math.min(Math.max(mid, host.t0 + w / 2 + 0.2), host.t1 - w / 2 - 0.2);
          const y0 = kind === "bedroom" || kind === "guest-room" ? 1.35 : 1.3;
          put("back", { t0: c - w / 2, t1: c + w / 2, y0, y1: y0 + Math.min(0.8, w * 0.7), exterior: host.exterior }, "art", 0.04, "accent");
        }
      }
      if (ART_SIDE.has(kind)) {
        // A pair of smaller frames on a side wall.
        const side = fullAt(walls.right, 1.3, lines.right.len * 0.45) ? "right" : fullAt(walls.left, 1.3, lines.left.len * 0.45) ? "left" : null;
        if (side) {
          const c = lines[side].len * 0.45;
          for (const dx of [-0.32, 0.32])
            put(side, { t0: c + dx - 0.25, t1: c + dx + 0.25, y0: 1.35, y1: 1.95, exterior: false }, "art", 0.035, "accent");
        }
      }
      if (PANELLED.has(kind))
        for (const side of ["left", "right", "front"] as const)
          for (const s of walls[side].filter((s) => s.y0 === 0 && s.t1 - s.t0 > 0.3)) put(side, { ...s, y1: Math.min(s.y1, RAIL) }, "wainscot", 0.02, "base");
      if (kind === "kitchen")
        for (const s of walls.back.filter((s) => s.y0 === 0 && s.y1 === WALL_H)) put("back", { ...s, y0: 0.9, y1: 1.48 }, "backsplash", 0.012, "base");
      if (kind === "bath") {
        for (const s of walls.back) put("back", s, "tile", 0.012, "base");
        for (const side of ["left", "right"] as const)
          for (const s of walls[side].filter((s) => s.y0 === 0)) put(side, { ...s, y1: Math.min(s.y1, 1.2) }, "tile", 0.012, "base");
      }
      if (CURTAINS.has(kind)) {
        for (const side of ["back", "left", "right", "front"] as const) {
          const l = lines[side];
          const axis = axisOf(l.e);
          const at = axis === "x" ? l.p0[1] : l.p0[0];
          const origin = axis === "x" ? l.p0[0] : l.p0[1];
          const sign = axis === "x" ? l.e[0] : l.e[1];
          for (const o of floor.openings.filter((o) => o.type === "window" && o.axis === (axis === "x" ? "x" : "y") && Math.abs((axis === "x" ? o.y : o.x) - at) < EPS)) {
            const c = ((axis === "x" ? o.x : o.y) - origin) * sign;
            if (c < 0 || c > l.len) continue;
            const ext = true;
            for (const dir of [-1, 1]) {
              const edge = c + dir * (o.width / 2 + 0.2);
              const t0 = Math.max(0.12, Math.min(edge - 0.2, l.len - 0.52));
              items.push({ ...onWall(room, floor.level, l, { t0, t1: t0 + 0.4, y0: 0.02, y1: 2.6, exterior: ext }, "curtain", 0.08, "textile") });
            }
            const r0 = Math.max(0.05, c - o.width / 2 - 0.45);
            const r1 = Math.min(l.len - 0.05, c + o.width / 2 + 0.45);
            items.push(onWall(room, floor.level, l, { t0: r0, t1: r1, y0: 2.62, y1: 2.66, exterior: ext }, "curtain rod", 0.12, "metal"));
          }
        }
      }
    }
  }
  return items;
}
