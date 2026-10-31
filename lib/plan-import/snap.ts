import type { Floor, Layout, Opening, Shell, Space, SpaceType } from "../layout/schema.ts";
import { validate } from "../layout/validate.ts";

// Turns the rooms a model read off someone's floor plan into a clean Layout: edges that almost meet are joined,
// gaps the model left become halls, every room gets a door and (where it needs one) a window, and the front door
// goes on the street side. The validator then says, in plain words, what still needs the user's eye.

/** One room as read from the drawing, in metres, x across and y from the front (street) edge back. */
export type ReadRoom = { name: string; kind: string; floor: number; x: number; y: number; w: number; h: number };
/** `entry`: where the front door was drawn, on the outside wall, if the reader saw one. */
export type ReadPlan = { spaceType: SpaceType; width: number; depth: number; rooms: ReadRoom[]; entry?: { x: number; y: number } | null };

const SNAP = 0.35; // edges closer than this are the same wall
const OUTER = 0.6; // an edge this close to the outside wall is the outside wall (readings often drift near the frame)
const SLIVER = 0.9; // a gap thinner than this is a reading error, not a hall
const DOOR = 0.9;
const ENTRY = 1.0;
const MIN_ROOM = 0.6;

const ZONE: Record<string, Space["zone"]> = {
  living: "public", lounge: "public", kitchen: "public", dining: "public", reception: "public", retail: "public",
  counter: "public", meeting: "public", fitting: "public",
  bedroom: "private", "guest-room": "private", office: "private", workspace: "private",
  bath: "service", laundry: "service", storage: "service", closet: "service", pantry: "service",
  corridor: "circulation", stairs: "circulation",
};
const NO_WINDOW = new Set(["bath", "storage", "closet", "corridor", "stairs", "pantry"]);
const PRIVATE = new Set(["bedroom", "guest-room", "bath", "office"]);

// Millimetre precision, so edges that should meet compare exactly.
const mm = (v: number) => Math.round(v * 1000) / 1000;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "room";

/** Joins edge positions that are within SNAP of each other (and of the outer walls) onto one value. */
function snapper(values: number[], ends: number[]): (v: number) => number {
  const outer = (v: number) => ends.find((e) => Math.abs(v - e) <= OUTER) ?? v;
  const sorted = values.map(outer).sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const v of sorted) {
    const g = groups.at(-1);
    if (g && v - g[g.length - 1] <= SNAP) g.push(v);
    else groups.push([v]);
  }
  const centres = groups.map((g) => {
    const end = ends.find((e) => g.some((v) => Math.abs(v - e) <= SNAP));
    return { lo: g[0], hi: g[g.length - 1], at: end ?? Math.round((g.reduce((t, v) => t + v, 0) / g.length) * 20) / 20 };
  });
  return (raw) => {
    const v = outer(raw);
    return centres.find((c) => v >= c.lo - 1e-9 && v <= c.hi + 1e-9)?.at ?? v;
  };
}

/** The floor's uncovered area as rectangles (on the grid of room edges), merged along rows. */
function gaps(spaces: Space[], W: number, D: number): { x: number; y: number; w: number; h: number }[] {
  const xs = [...new Set([0, W, ...spaces.flatMap((s) => [s.rect.x, s.rect.x + s.rect.w])])].sort((a, b) => a - b);
  const ys = [...new Set([0, D, ...spaces.flatMap((s) => [s.rect.y, s.rect.y + s.rect.h])])].sort((a, b) => a - b);
  const covered = (cx: number, cy: number) => spaces.some((s) => cx > s.rect.x && cx < s.rect.x + s.rect.w && cy > s.rect.y && cy < s.rect.y + s.rect.h);
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (let j = 0; j + 1 < ys.length; j++) {
    let run: { x: number; w: number } | null = null;
    for (let i = 0; i + 1 <= xs.length; i++) {
      const free = i + 1 < xs.length && !covered((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2);
      if (free && run) run.w = xs[i + 1] - run.x;
      else if (free) run = { x: xs[i], w: xs[i + 1] - xs[i] };
      else if (run) {
        out.push({ x: run.x, y: ys[j], w: run.w, h: ys[j + 1] - ys[j] });
        run = null;
      }
    }
  }
  // Stack row pieces with the same x span into taller rectangles.
  const merged: typeof out = [];
  for (const g of out) {
    const above = merged.find((m) => Math.abs(m.x - g.x) < 1e-9 && Math.abs(m.w - g.w) < 1e-9 && Math.abs(m.y + m.h - g.y) < 1e-9);
    if (above) above.h += g.h;
    else merged.push({ ...g });
  }
  return merged.filter((g) => g.w * g.h > 0.05).map((g) => ({ x: mm(g.x), y: mm(g.y), w: mm(g.w), h: mm(g.h) }));
}

/** The stretch of wall two rectangles share, if any: a line along x or y, from..to. */
function shared(a: Space["rect"], b: Space["rect"]): { axis: "x" | "y"; at: number; from: number; to: number } | null {
  const ox = [Math.max(a.x, b.x), Math.min(a.x + a.w, b.x + b.w)];
  const oy = [Math.max(a.y, b.y), Math.min(a.y + a.h, b.y + b.h)];
  if (Math.abs(a.y + a.h - b.y) < 1e-6 || Math.abs(b.y + b.h - a.y) < 1e-6) {
    const at = Math.abs(a.y + a.h - b.y) < 1e-6 ? b.y : a.y;
    return ox[1] - ox[0] > 1e-6 ? { axis: "x", at, from: ox[0], to: ox[1] } : null;
  }
  if (Math.abs(a.x + a.w - b.x) < 1e-6 || Math.abs(b.x + b.w - a.x) < 1e-6) {
    const at = Math.abs(a.x + a.w - b.x) < 1e-6 ? b.x : a.x;
    return oy[1] - oy[0] > 1e-6 ? { axis: "y", at, from: oy[0], to: oy[1] } : null;
  }
  return null;
}

/** The parts of a room's edges that are outside walls, longest first. */
function facades(r: Space["rect"], W: number, D: number) {
  const out: { axis: "x" | "y"; at: number; from: number; to: number; front: boolean }[] = [];
  if (Math.abs(r.y) < 1e-6) out.push({ axis: "x", at: 0, from: r.x, to: r.x + r.w, front: true });
  if (Math.abs(r.y + r.h - D) < 1e-6) out.push({ axis: "x", at: D, from: r.x, to: r.x + r.w, front: false });
  if (Math.abs(r.x) < 1e-6) out.push({ axis: "y", at: 0, from: r.y, to: r.y + r.h, front: false });
  if (Math.abs(r.x + r.w - W) < 1e-6) out.push({ axis: "y", at: W, from: r.y, to: r.y + r.h, front: false });
  return out.sort((a, b) => b.to - b.from - (a.to - a.from));
}

const opening = (id: string, type: Opening["type"], between: [string, string], line: { axis: "x" | "y"; at: number }, mid: number, width: number): Opening =>
  line.axis === "x" ? { id, type, between, x: mid, y: line.at, axis: "x", width } : { id, type, between, x: line.at, y: mid, axis: "y", width };

function buildFloor(level: number, rooms: ReadRoom[], W: number, D: number, sx: (v: number) => number, sy: (v: number) => number, entryAt?: { x: number; y: number } | null): Floor {
  const used = new Set<string>();
  const spaces: Space[] = [];
  for (const r of rooms) {
    const x0 = Math.max(0, sx(r.x));
    const x1 = Math.min(W, sx(r.x + r.w));
    const y0 = Math.max(0, sy(r.y));
    const y1 = Math.min(D, sy(r.y + r.h));
    if (x1 - x0 < MIN_ROOM || y1 - y0 < MIN_ROOM) continue;
    let id = slug(r.name);
    for (let n = 2; used.has(id); n++) id = `${slug(r.name)}-${n}`;
    used.add(id);
    const kind = ZONE[r.kind] ? r.kind : "living";
    spaces.push({ id, name: r.name, kind, zone: ZONE[kind], rect: { x: mm(x0), y: mm(y0), w: mm(x1 - x0), h: mm(y1 - y0) } });
  }
  // Rooms read as slightly overlapping share a wall: put it in the middle of the overlap. A room drawn inside
  // another (or a large overlap) is left for the validator to report.
  for (let i = 0; i < spaces.length; i++)
    for (let j = i + 1; j < spaces.length; j++) {
      const a = spaces[i].rect;
      const b = spaces[j].rect;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox <= 1e-6 || oy <= 1e-6) continue;
      if (ox <= oy && ox <= 0.8 && ox < Math.min(a.w, b.w) * 0.4) {
        const [l, r] = a.x <= b.x ? [a, b] : [b, a];
        const mid = mm((r.x + l.x + l.w) / 2);
        const right = r.x + r.w;
        l.w = mm(mid - l.x);
        r.x = mid;
        r.w = mm(right - mid);
      } else if (oy < ox && oy <= 0.8 && oy < Math.min(a.h, b.h) * 0.4) {
        const [t, u] = a.y <= b.y ? [a, b] : [b, a];
        const mid = mm((u.y + t.y + t.h) / 2);
        const bottom = u.y + u.h;
        t.h = mm(mid - t.y);
        u.y = mid;
        u.h = mm(bottom - mid);
      }
    }
  // A thin strip left beside a room is a misread wall position: the room takes it, when it runs the room's length.
  for (let guard = 0; guard < 50; guard++) {
    const thin = gaps(spaces, W, D).find((g) => Math.min(g.w, g.h) < SLIVER);
    if (!thin) break;
    const flat = thin.w >= thin.h;
    const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    const host = spaces.find((sp) =>
      sp.kind !== "stairs" &&
      (flat
        ? same(sp.rect.x, thin.x) && same(sp.rect.w, thin.w) && (same(sp.rect.y + sp.rect.h, thin.y) || same(sp.rect.y, thin.y + thin.h))
        : same(sp.rect.y, thin.y) && same(sp.rect.h, thin.h) && (same(sp.rect.x + sp.rect.w, thin.x) || same(sp.rect.x, thin.x + thin.w))),
    );
    if (!host) break;
    const r = host.rect;
    host.rect = { x: mm(Math.min(r.x, thin.x)), y: mm(Math.min(r.y, thin.y)), w: mm(flat ? r.w : r.w + thin.w), h: mm(flat ? r.h + thin.h : r.h) };
  }
  // What's left between rooms: a hall where it's wide enough to walk, otherwise wall the reading missed.
  let halls = 0;
  let walls = 0;
  for (const g of gaps(spaces, W, D)) {
    if (Math.min(g.w, g.h) >= SLIVER) {
      halls++;
      spaces.push({ id: halls > 1 ? `hall-${halls}` : "hall", name: "Hall", kind: "corridor", zone: "circulation", rect: g });
    } else spaces.push({ id: `wall-${++walls}`, name: "", kind: "void", zone: "circulation", rect: g });
  }

  const openings: Opening[] = [];
  const real = spaces.filter((sp) => sp.kind !== "void");
  const LIVING = ["living", "lounge", "dining", "reception", "retail", "counter"];

  // The front door: where the drawing shows it, else on the street side, into a hall or a living space.
  let start: Space | undefined;
  if (level === 0) {
    const options = real.filter((sp) => (sp.kind === "corridor" && Math.min(sp.rect.w, sp.rect.h) >= SLIVER) || LIVING.includes(sp.kind) || sp.kind === "kitchen");
    const pick = (sp: Space) => facades(sp.rect, W, D).filter((f) => f.to - f.from >= ENTRY + 0.2);
    let best: { sp: Space; f: ReturnType<typeof facades>[number]; at: number; score: number } | null = null;
    for (const sp of options)
      for (const f of pick(sp)) {
        const along = entryAt ? Math.min(Math.max(f.axis === "x" ? entryAt.x : entryAt.y, f.from + 0.1 + ENTRY / 2), f.to - 0.1 - ENTRY / 2) : f.from + 0.1 + ENTRY / 2;
        const [px, py] = f.axis === "x" ? [along, f.at] : [f.at, along];
        // Near the drawn door if there is one; otherwise halls, then living spaces, on the street side first.
        // Without a drawn door, a living space beats a hall: a strip the reading left may not be a real hall.
        const kindScore = LIVING.includes(sp.kind) ? 0 : sp.kind === "corridor" ? 10 : 30;
        const score = entryAt ? Math.hypot(px - entryAt.x, py - entryAt.y) : kindScore + (f.front ? 0 : 5);
        if (!best || score < best.score) best = { sp, f, at: along, score };
      }
    if (best) {
      start = best.sp;
      openings.push(opening("door-entry", "door", [best.sp.id, "outside"], best.f, best.at, ENTRY));
    }
  } else start = real.find((sp) => sp.kind === "stairs");
  start ??= real.find((sp) => sp.zone === "public") ?? real[0];

  // Doors, grown outward from the front door the way a person walks in: every room joins a space already
  // reached, through halls and living spaces first. Bedrooms, baths and the stairs are never a way through to
  // another room, and a private room only opens off the kitchen if nothing else reaches it.
  const reached = new Set<string>(start ? [start.id] : []);
  const pass = (from: Space, to: Space, loose: boolean) => {
    if (from.kind === "stairs" && to.zone !== "circulation") return false;
    if (!loose && !(from.zone === "circulation" || from.zone === "public")) return false;
    // An open kitchen is part of the living space (a great room); only a closed one can't lead to a bedroom.
    if (!loose && PRIVATE.has(to.kind) && from.kind === "kitchen" && from.open === false) return false;
    return true;
  };
  for (const loose of [false, true])
    for (let changed = true; changed; ) {
      changed = false;
      const waiting = real.filter((sp) => !reached.has(sp.id)).sort((p, q) => rankOf(p) - rankOf(q));
      for (const room of waiting) {
        const parent = real
          .filter((n) => reached.has(n.id) && pass(n, room, loose))
          .map((n) => ({ n, s: shared(n.rect, room.rect) }))
          .filter((x) => x.s && x.s.to - x.s.from >= DOOR + 0.1)
          .sort((p, q) => rankOf(p.n) - rankOf(q.n) || q.s!.to - q.s!.from - (p.s!.to - p.s!.from))[0];
        if (!parent) continue;
        const sh = parent.s!;
        openings.push(opening(room.kind === "stairs" ? "door-stairs" : `door-${room.id}`, "door", [room.id, parent.n.id], sh, sh.from + 0.1 + DOOR / 2, DOOR));
        reached.add(room.id);
        changed = true;
      }
    }

  // Windows on the longest outside wall of every room that needs one, clear of the front door.
  const entry = openings.find((o) => o.id === "door-entry");
  for (const room of real.filter((sp) => !NO_WINDOW.has(sp.kind))) {
    const f = facades(room.rect, W, D)[0];
    if (!f) continue;
    let from = f.from;
    let to = f.to;
    if (entry && entry.between[0] === room.id && entry.axis === f.axis && Math.abs((f.axis === "x" ? entry.y : entry.x) - f.at) < 1e-6) {
      const e = f.axis === "x" ? entry.x : entry.y;
      // Take the longer side of the wall beside the door.
      if (e - f.from > f.to - e) to = e - ENTRY / 2 - 0.3;
      else from = e + ENTRY / 2 + 0.3;
    }
    const width = Math.min((to - from) * 0.5, 2.4);
    if (width >= 0.4) openings.push(opening(`win-${room.id}`, "window", [room.id, "outside"], f, (from + to) / 2, width));
  }
  return { level, spaces, openings };
}

// Halls first, then living spaces, then anything else.
const rankOf = (s: Space) => (s.zone === "circulation" ? 0 : s.zone === "public" && s.kind !== "kitchen" ? 1 : s.kind === "kitchen" ? 3 : 2);

// For a user's own plan, the building is what it is: a small powder room or a windowless study is their
// reality, not an error. Only problems that break the model itself block it; the rest are advice.
const ADVICE = /narrower than|smaller than|has no window|opens off the kitchen|opens into the stairs|front door opens into/;
/** The validator's messages that stop a user's own plan being modelled (the rest are advice). */
export const blocking = (errors: string[]) => errors.filter((e) => !ADVICE.test(e));

/**
 * A Layout from what was read. `problems` must be fixed before the plan can be used (overlaps, holes, rooms
 * you can't reach); `advice` is what an architect would point out, shown but not blocking.
 */
export function snapPlan(read: ReadPlan): { layout: Layout; problems: string[]; advice: string[] } {
  const W = read.width;
  const D = read.depth;
  const levels = [...new Set(read.rooms.map((r) => r.floor))].sort((a, b) => a - b);
  // One stair serves both floors: read the upper stairwell as exactly the lower one.
  const rooms = read.rooms.map((r) => ({ ...r }));
  const low = rooms.find((r) => r.kind === "stairs" && r.floor === levels[0]);
  const high = rooms.find((r) => r.kind === "stairs" && r.floor === levels[1]);
  if (low && high) Object.assign(high, { x: low.x, y: low.y, w: low.w, h: low.h });
  // Walls stack between floors, so edges are joined across all floors at once.
  const sx = snapper(rooms.flatMap((r) => [r.x, r.x + r.w]), [0, W]);
  const sy = snapper(rooms.flatMap((r) => [r.y, r.y + r.h]), [0, D]);
  const floors = levels.map((level, i) => ({ ...buildFloor(i, rooms.filter((r) => r.floor === level), W, D, sx, sy, i === 0 ? read.entry : null), level: i }));
  const layout: Layout = { spaceType: read.spaceType, shell: { width: W, depth: D } as Shell, floors, concept: { id: "own", name: "Your plan", why: [] } };
  const all = validate(layout);
  return { layout, problems: blocking(all), advice: all.filter((e) => ADVICE.test(e)) };
}
