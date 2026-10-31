import type { Floor, Layout, Opening, Program, ProgramRoom, Shell, Space } from "./schema.ts";
import { DOOR, ENTRY, frontDepth, HALL, placeFloor, STAIR_RUN, stairWidth, transpose, VARIANTS, widths } from "./place.ts";
import { validate } from "./validate.ts";

// Layout ideas an architect would actually offer, not one plan flipped three ways.
//   hall-street: a central hall with rooms both sides, living rooms to the street.
//   hall-garden: the same hall, living rooms to the back garden, bedrooms to the street.
//   great-room:  living, dining and kitchen as one open band down one side, entered from the front,
//                with a private wing beside it.
//   split:       an open living band in the middle, entered from the front, with a wing at each end.
// Every concept keeps the stairs at the right end of the hall line, so the floors always line up.

export type ConceptId = "hall-street" | "hall-garden" | "great-room" | "split";
export const CONCEPT_NAMES: Record<ConceptId, string> = {
  "hall-street": "Central hall, living to the street",
  "hall-garden": "Central hall, living to the garden",
  "great-room": "Open great room",
  split: "Split plan",
};
export const CONCEPT_IDS = Object.keys(CONCEPT_NAMES) as ConceptId[];

// A wing needs one room's width; the wing holding the stairs also needs the 3 m stair run and a bit of hall.
const wingMin = (stairs: boolean) => (stairs ? STAIR_RUN + 0.6 : 2.4);
const sum = (rooms: ProgramRoom[]) => rooms.reduce((t, r) => t + r.area, 0);
const NO_WINDOW = new Set(["storage", "closet", "server"]);
// One bath per floor at most opens into a bedroom (the biggest, as the main en-suite), and only when the floor
// has another bath that everyone else can reach.
function ensuiteFor(rooms: ProgramRoom[]): string | null {
  const baths = rooms.filter((r) => r.kind === "bath").sort((a, b) => b.area - a.area);
  return baths.length >= 2 ? baths[0].id : null;
}

type Box = { x0: number; x1: number };

/** Shift a floor sideways by dx metres. */
function shift(floor: Floor, dx: number): Floor {
  return {
    ...floor,
    spaces: floor.spaces.map((s) => ({ ...s, rect: { ...s.rect, x: s.rect.x + dx } })),
    openings: floor.openings.map((o) => ({ ...o, x: o.x + dx })),
  };
}

/**
 * A wing: the proven hall layout on the strip x0..x1. Its hall opens at one end onto the open band
 * (`link`), and the stairs sit at the other end when `stairs` is set. Returns the floor and the id of its hall.
 */
function wing(rooms: ProgramRoom[], box: Box, D: number, front: number, stairs: boolean, link: "left" | "right", hallId: string) {
  // placeFloor puts its "entry" at the left end unless mirrored; that end becomes the link to the band.
  // A wing holds only private and service rooms, so either group may take the front strip (which shares
  // its length with the stairwell): try one way, then the other.
  const shell = { width: box.x1 - box.x0, depth: D };
  const tryPlace = (publicSide: "front" | "back") => placeFloor(0, rooms, shell, stairs, { ...VARIANTS[0], publicSide, mirror: link === "right" }, front);
  let f: Floor;
  try {
    f = tryPlace("front");
  } catch {
    f = tryPlace("back");
  }
  const rename = (id: string) => (id === "hall" ? hallId : id);
  const floor = shift(
    {
      ...f,
      spaces: f.spaces.map((s) => ({ ...s, id: rename(s.id) })),
      openings: f.openings.map((o) => ({ ...o, between: [rename(o.between[0]), rename(o.between[1])] as [string, string] })),
    },
    box.x0,
  );
  return floor;
}

/**
 * The open band: public rooms with no hall, in a front row (down to the hall line, so wing halls open onto it)
 * and a back row. Every room keeps a facade for its window; doors join neighbours so every room is reachable.
 */
// `entryWall`: "front" puts the front door on the long facade (y = 0); "end" puts it on the band's end wall
// (x = box.x0), which is the street side when a deep lot is laid out turned.
function band(
  rooms: ProgramRoom[], box: Box, D: number, front: number, livingAt: "front" | "back", entry: boolean,
  backBox: Box = box, wings: ("left" | "right")[] = ["right"], entryWall: "front" | "end" = "front", rows?: Record<string, "front" | "back">,
): Floor {
  const split = front + HALL;
  const living = rooms.filter((r) => r.kind === "living" || r.kind === "lounge" || r.kind === "reception");
  const rest = rooms.filter((r) => !living.includes(r)).sort((a, b) => b.area - a.area);
  let near = [...living];
  let far: ProgramRoom[] = [];
  // Fill the far row toward its share of the depth, biggest rooms first: a room goes there only if that brings
  // the row closer to its share, so a big room never lands in a shallow row. One lone room spans the full depth.
  const farShare = livingAt === "front" ? (D - split) / D : split / D;
  const target = sum(rooms) * farShare;
  for (const r of rest) (Math.abs(sum(far) + r.area - target) < Math.abs(sum(far) - target) ? far : near).push(r);
  // After an edit, rooms that already had a row keep it; only new rooms are placed by size.
  if (rows) {
    const nearSide = livingAt === "front" ? "front" : "back";
    const all = [...near, ...far];
    const isNear = (r: ProgramRoom) => (rows[r.id] ? rows[r.id] === nearSide : near.includes(r));
    near = all.filter(isNear);
    far = all.filter((r) => !isNear(r));
  }
  if (!near.length) [near, far] = [far.slice(0, 1), far.slice(1)];
  // Keep the kitchen away from the wings, so bedrooms and baths open off the living or dining area instead.
  const awayFromWings = (row: ProgramRoom[]) => {
    const kitchens = row.filter((r) => r.kind === "kitchen");
    const rest = row.filter((r) => r.kind !== "kitchen");
    if (!kitchens.length) return row;
    if (wings.includes("left") && wings.includes("right")) {
      const mid = Math.floor(rest.length / 2);
      return [...rest.slice(0, mid), ...kitchens, ...rest.slice(mid)];
    }
    return wings.includes("right") ? [...kitchens, ...rest] : [...rest, ...kitchens];
  };
  let [frontRow, backRow] = (livingAt === "front" ? [near, far] : [far, near]).map(awayFromWings);
  // The front door must open into a living space, not the kitchen: a front row of only kitchens swaps rows.
  if (entry && frontRow.length && frontRow.every((r) => r.kind === "kitchen") && backRow.some((r) => r.kind !== "kitchen")) [frontRow, backRow] = [backRow, frontRow];

  const spaces: Space[] = [];
  const openings: Opening[] = [];
  if (backBox !== box && !backRow.length) throw new Error("no back row to stretch under the wing");
  const row = (list: ProgramRoom[], y: number, h: number, at: Box = box) => {
    if (!list.length) return [] as Space[];
    const ws = widths(list, at.x1 - at.x0);
    let x = at.x0;
    return list.map((r, i) => {
      const s: Space = { id: r.id, name: r.name, kind: r.kind, zone: r.zone, rect: { x, y, w: ws[i], h } };
      x += ws[i];
      spaces.push(s);
      return s;
    });
  };
  const fr = row(frontRow, 0, backRow.length ? split : D);
  const br = backRow.length ? row(backRow, split, D - split, backBox) : [];

  // The front door opens into the front-row room at the middle of the band, near one end of its wall,
  // and that room's window takes the rest of the wall, so the two never overlap.
  const mid = (box.x0 + box.x1) / 2;
  const onEnd = entryWall === "end" && box.x0 === 0;
  const notKitchen = fr.filter((s) => s.kind !== "kitchen");
  const entryRoom = entry && fr.length
    ? onEnd
      ? (fr[0].kind !== "kitchen" ? fr[0] : null)
      : (notKitchen.find((s) => s.rect.x <= mid && mid <= s.rect.x + s.rect.w) ?? notKitchen.sort((a, b) => Math.abs(a.rect.x + a.rect.w / 2 - mid) - Math.abs(b.rect.x + b.rect.w / 2 - mid))[0] ?? null)
    : null;
  if (entry && !entryRoom) throw new Error("no living space at the front for the front door");
  if (entryRoom && onEnd)
    openings.push({ id: "door-entry", type: "door", between: [entryRoom.id, "outside"], x: 0, y: entryRoom.rect.y + entryRoom.rect.h / 2, axis: "y", width: ENTRY });
  else if (entryRoom) openings.push({ id: "door-entry", type: "door", between: [entryRoom.id, "outside"], x: entryRoom.rect.x + 0.3 + ENTRY / 2, y: 0, axis: "x", width: ENTRY });
  for (const s of spaces) {
    const atFront = s.rect.y === 0;
    const atBack = Math.abs(s.rect.y + s.rect.h - D) < 1e-9;
    if (!atFront && !atBack) continue;
    // The stretch of facade free for a window: all of it, or what the front door leaves.
    const dodge = s === entryRoom && !onEnd && atFront;
    const from = dodge ? s.rect.x + 0.3 + ENTRY + 0.3 : s.rect.x;
    const to = s.rect.x + s.rect.w;
    const width = Math.min((to - from) * (dodge ? 0.7 : 0.5), 2.4);
    if (width > 0.3) openings.push({ id: `win-${s.id}`, type: "window", between: [s.id, "outside"], x: (from + to) / 2, y: atFront ? 0 : D, axis: "x", width });
  }
  // Neighbours in a row share a side wall; each back-row room joins the front room it overlaps most.
  for (const r of [fr, br])
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1];
      const b = r[i];
      openings.push({ id: `door-${b.id}-${a.id}`, type: "door", between: [b.id, a.id], x: b.rect.x, y: b.rect.y + b.rect.h / 2, axis: "y", width: DOOR });
    }
  for (const b of br) {
    const best = fr
      .map((a) => ({ a, lo: Math.max(a.rect.x, b.rect.x), hi: Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w) }))
      .sort((p, q) => q.hi - q.lo - (p.hi - p.lo))[0];
    if (best && best.hi - best.lo >= DOOR)
      openings.push({ id: `door-${b.id}-${best.a.id}`, type: "door", between: [b.id, best.a.id], x: (best.lo + best.hi) / 2, y: split, axis: "x", width: DOOR });
  }
  return { level: 0, spaces, openings };
}

/**
 * A small wing with no stairs: its rooms stack front to back, each the full width of the wing, with a window
 * on the outside wall and a door straight into the band room beside it (a study off the living room).
 */
function column(rooms: ProgramRoom[], box: Box, D: number, b: Floor, linkAt: number, outsideAt: number, ensuite: string | null): Floor {
  const hs = widths(rooms, D);
  const spaces: Space[] = [];
  const openings: Opening[] = [];
  let y = 0;
  rooms.forEach((r, i) => {
    const s: Space = { id: r.id, name: r.name, kind: r.kind, zone: r.zone, rect: { x: box.x0, y, w: box.x1 - box.x0, h: hs[i] } };
    spaces.push(s);
    const next = b.spaces
      // A room off the living band opens into the living or dining area, never the kitchen.
      .filter((n) => n.kind !== "kitchen" && (Math.abs(n.rect.x - linkAt) < 1e-9 || Math.abs(n.rect.x + n.rect.w - linkAt) < 1e-9))
      .map((n) => ({ n, lo: Math.max(y, n.rect.y), hi: Math.min(y + hs[i], n.rect.y + n.rect.h) }))
      .sort((p, q) => q.hi - q.lo - (p.hi - p.lo))[0];
    // A bath stacked on a bedroom is its en-suite: it opens into the bedroom, not the living band.
    const prev = spaces[i - 1];
    if (r.id === ensuite && prev?.kind === "bedroom")
      openings.push({ id: `door-${r.id}`, type: "door", between: [r.id, prev.id], x: box.x0 + Math.min(DOOR, (box.x1 - box.x0) / 2), y, axis: "x", width: DOOR });
    else if (next && next.hi - next.lo >= DOOR)
      openings.push({ id: `door-${r.id}`, type: "door", between: [r.id, next.n.id], x: linkAt, y: next.lo + 0.1 + DOOR / 2, axis: "y", width: DOOR });
    if (!NO_WINDOW.has(r.kind))
      openings.push({ id: `win-${r.id}`, type: "window", between: [r.id, "outside"], x: outsideAt, y: y + hs[i] / 2, axis: "y", width: r.kind === "bath" ? 0.6 : Math.min(hs[i] * 0.5, 2.4) });
    y += hs[i];
  });
  return { level: 0, spaces, openings };
}

/**
 * A gallery wing: a hall runs front to back along the living band (open to it), and the rooms stack in a
 * column beyond it, each with a door on the hall and a window on the outside wall. Fits more bedrooms
 * into a narrow wing than a cross hall does. Only for wings without stairs.
 */
function gallery(rooms: ProgramRoom[], box: Box, D: number, b: Floor, linkAt: number, outsideAt: number, hallId: string, front: number, ensuite: string | null): Floor {
  const bandLeft = linkAt === box.x0;
  const hall: Space = { id: hallId, name: "Hall", kind: "corridor", zone: "circulation", rect: { x: bandLeft ? box.x0 : box.x1 - HALL, y: 0, w: HALL, h: D } };
  const x = bandLeft ? box.x0 + HALL : box.x0;
  const w = box.x1 - box.x0 - HALL;
  const doorX = bandLeft ? box.x0 + HALL : box.x1 - HALL;
  const hs = widths(rooms, D);
  const spaces: Space[] = [hall];
  const openings: Opening[] = [];
  let y = 0;
  rooms.forEach((r, i) => {
    const s: Space = { id: r.id, name: r.name, kind: r.kind, zone: r.zone, rect: { x, y, w, h: hs[i] } };
    const prev = spaces[spaces.length - 1];
    spaces.push(s);
    if (r.id === ensuite && prev.kind === "bedroom")
      openings.push({ id: `door-${r.id}`, type: "door", between: [r.id, prev.id], x: x + w / 2, y, axis: "x", width: DOOR });
    else openings.push({ id: `door-${r.id}`, type: "door", between: [r.id, hallId], x: doorX, y: y + 0.1 + DOOR / 2, axis: "y", width: DOOR });
    if (!NO_WINDOW.has(r.kind))
      openings.push({ id: `win-${r.id}`, type: "window", between: [r.id, "outside"], x: outsideAt, y: y + hs[i] / 2, axis: "y", width: r.kind === "bath" ? 0.6 : Math.min(hs[i] * 0.5, 2.4) });
    y += hs[i];
  });
  return linkWing({ level: 0, spaces, openings }, b, hallId, linkAt, front);
}

/**
 * A compact stairs wing for few rooms: the rooms sit in the front strip, the hall and stairs on the hall line,
 * and the living band's back row stretches underneath, so no strip is left empty.
 */
function stairsWing(rooms: ProgramRoom[], box: Box, D: number, front: number, b: Floor, hallId: string): Floor {
  const split = front + HALL;
  if (split > D) throw new Error("no room behind the hall line");
  // Same pattern as the hall layout: the hall runs the wing's full width, the stairwell closes the far end of
  // the front strip, and every room opens onto the hall.
  const hall: Space = { id: hallId, name: "Hall", kind: "corridor", zone: "circulation", rect: { x: box.x0, y: front, w: box.x1 - box.x0, h: HALL } };
  const sw = stairWidth(front);
  const stairs: Space = { id: "stairs", name: "Stairs", kind: "stairs", zone: "circulation", rect: { x: box.x1 - sw, y: 0, w: sw, h: front } };
  const spaces: Space[] = [hall, stairs];
  const openings: Opening[] = [{ id: "door-stairs", type: "door", between: ["stairs", hallId], x: box.x1 - sw + 0.1 + DOOR / 2, y: front, axis: "x", width: DOOR }];
  const ws = widths(rooms, box.x1 - sw - box.x0);
  let x = box.x0;
  rooms.forEach((r, i) => {
    const w = ws[i];
    spaces.push({ id: r.id, name: r.name, kind: r.kind, zone: r.zone, rect: { x, y: 0, w, h: front } });
    const dw = Math.min(DOOR, w - 0.2);
    openings.push({ id: `door-${r.id}`, type: "door", between: [r.id, hallId], x: x + 0.1 + dw / 2, y: front, axis: "x", width: dw });
    if (!NO_WINDOW.has(r.kind))
      openings.push({ id: `win-${r.id}`, type: "window", between: [r.id, "outside"], x: x + w / 2, y: 0, axis: "x", width: r.kind === "bath" ? 0.6 : Math.min(w * 0.5, 2.4) });
    x += w;
  });
  return linkWing({ level: 0, spaces, openings }, b, hallId, box.x0, front);
}

/** Which way a wing without stairs lays out its rooms: a cross hall, or a gallery hall along the band. */
type WingStyle = "hall" | "gallery";

/** The wing for these rooms: a column for one or two rooms, otherwise a cross hall or a gallery. */
function makeWing(rooms: ProgramRoom[], box: Box, D: number, b: Floor, side: "left" | "right", stairs: boolean, hallId: string, front: number, style: WingStyle, ensuite: string | null): Floor {
  // `side` is where the wing sits; the band is on the other side.
  const linkAt = side === "left" ? box.x1 : box.x0;
  const outsideAt = side === "left" ? box.x0 : box.x1;
  if (!stairs && rooms.length <= 2) return column(rooms, box, D, b, linkAt, outsideAt, ensuite);
  if (!stairs && style === "gallery") return gallery(rooms, box, D, b, linkAt, outsideAt, hallId, front, ensuite);
  return linkWing(wing(rooms, box, D, front, stairs, side === "left" ? "right" : "left", hallId), b, hallId, linkAt, front);
}

/** Joins a wing's hall end to the band room beside it. Replaces the wing's own "door-entry". */
function linkWing(w: Floor, b: Floor, hallId: string, at: number, front: number): Floor {
  const y = front + HALL / 2;
  const room = b.spaces.find((s) => (Math.abs(s.rect.x - at) < 1e-9 || Math.abs(s.rect.x + s.rect.w - at) < 1e-9) && s.rect.y <= y && y <= s.rect.y + s.rect.h);
  if (!room) throw new Error("the wing's hall has no room to open onto");
  const openings = w.openings.filter((o) => o.id !== "door-entry");
  openings.push({ id: `door-${hallId}-link`, type: "door", between: [hallId, room.id], x: at, y, axis: "y", width: DOOR });
  return { ...w, openings };
}

const merge = (level: number, ...parts: Floor[]): Floor => ({ level, spaces: parts.flatMap((p) => p.spaces), openings: parts.flatMap((p) => p.openings) });

/** Width of a band holding `area` out of `total`, kept between 25% and 65% of the floor and leaving `reserve` m for the wings. */
function bandWidth(area: number, total: number, W: number, reserve: number, share?: number) {
  const s = share ?? area / total;
  return Math.min(Math.max(W * s, W * 0.25), W * 0.65, W - reserve);
}

/** How the floor is shared out: the band's share of the width, and the left wing's share of what's left. */
type Fit = { share?: number; left?: number; wing?: WingStyle; compact?: boolean; deep?: boolean; rows?: Record<string, "front" | "back"> };
type Floorplan = (level: number, rooms: ProgramRoom[], shell: Shell, stairs: boolean, front: number, fit: Fit) => Floor;

const hallFloor = (publicSide: "front" | "back"): Floorplan => (level, rooms, shell, stairs, front) =>
  placeFloor(level, rooms, shell, stairs, { publicSide, mirror: false, serviceWithPublic: false }, front);

const greatRoom: Floorplan = (level, rooms, shell, stairs, front, { share, wing: wingStyle = "hall", compact = false, deep = false, rows }) => {
  const pub = rooms.filter((r) => r.zone === "public");
  const priv = rooms.filter((r) => r.zone !== "public");
  if (!pub.length || !priv.length) return hallFloor("front")(level, rooms, shell, stairs, front, {});
  const bw = bandWidth(sum(pub), sum(rooms), shell.width, wingMin(stairs), share);
  const wingBox = { x0: bw, x1: shell.width };
  if (stairs && compact) {
    const b = band(pub, { x0: 0, x1: bw }, shell.depth, front, "front", level === 0, { x0: 0, x1: shell.width }, ["right"], deep ? "end" : "front", rows);
    return merge(level, b, stairsWing(priv, wingBox, shell.depth, front, b, "hall"));
  }
  const b = band(pub, { x0: 0, x1: bw }, shell.depth, front, "front", level === 0, undefined, ["right"], deep ? "end" : "front", rows);
  return merge(level, b, makeWing(priv, wingBox, shell.depth, b, "right", stairs, "hall", front, wingStyle, ensuiteFor(rooms)));
};

const splitPlan: Floorplan = (level, rooms, shell, stairs, front, fit) => {
  const pub = rooms.filter((r) => r.zone === "public");
  const priv = rooms.filter((r) => r.zone !== "public");
  if (!pub.length || priv.length < 2) return greatRoom(level, rooms, shell, stairs, front, fit);
  // The main bedroom (and the biggest bath) go to one end, everything else to the other.
  const beds = priv.filter((r) => r.kind === "bedroom").sort((a, b) => b.area - a.area);
  const left: ProgramRoom[] = beds.length > 1 ? [beds[0]] : [priv.sort((a, b) => b.area - a.area)[0]];
  const bath = priv.filter((r) => r.kind === "bath" && !left.includes(r)).sort((a, b) => b.area - a.area)[0];
  if (bath && beds.length > 1 && priv.length > 3) left.push(bath);
  const right = priv.filter((r) => !left.includes(r));
  const W = shell.width;
  const bw = bandWidth(sum(pub), sum(rooms), W, wingMin(false) + wingMin(stairs), fit.share);
  const rest = W - bw;
  const lw = Math.max(wingMin(false), Math.min(rest - wingMin(stairs), rest * (fit.left ?? sum(left) / sum(priv))));
  const box = { x0: lw, x1: lw + bw };
  const style = fit.wing ?? "hall";
  const compact = stairs && !!fit.compact;
  const b = band(pub, box, shell.depth, front, "front", level === 0, compact ? { x0: box.x0, x1: W } : box, ["left", "right"], "front", fit.rows);
  const l = makeWing(left, { x0: 0, x1: lw }, shell.depth, b, "left", false, "hall-2", front, style, ensuiteFor(rooms));
  const r = compact ? stairsWing(right, { x0: box.x1, x1: W }, shell.depth, front, b, "hall") : makeWing(right, { x0: box.x1, x1: W }, shell.depth, b, "right", stairs, "hall", front, style, ensuiteFor(rooms));
  return merge(level, b, l, r);
};

const PLANS: Record<ConceptId, Floorplan> = {
  "hall-street": hallFloor("front"),
  "hall-garden": hallFloor("back"),
  "great-room": greatRoom,
  split: splitPlan,
};

/** A closed kitchen keeps its walls even in an open-plan concept. */
export type Tweaks = {
  closedKitchen?: boolean;
  /**
   * Score a floor (in the building's own coordinates), lower is better: every arrangement that passes the rules is
   * scored and the best kept, instead of the first. The workspace uses it to keep an edited plan close to how it was.
   */
  prefer?: (floor: Floor) => number;
  /** Which row of an open band each room sat in before an edit, so rooms keep their places when sizes change. */
  rows?: Record<string, "front" | "back">;
};

/**
 * The layout for one concept, or null when the rooms can't fit it on this shell. Each floor tries a few
 * ways of sharing out its width (a ground floor full of living rooms wants a wide band, a bedroom floor a
 * narrow one) and keeps the first that passes the validator. The stairs never move, so floors always line up.
 */
export function placeConcept(program: Program, shell: Shell, concept: ConceptId, tweaks: Tweaks = {}, why: string[] = []): Layout | null {
  const deep = shell.depth > shell.width;
  const frame = deep ? { width: shell.depth, depth: shell.width } : shell;
  const shares = [undefined, 0.45, 0.55, 0.4, 0.6, 0.35, 0.3, 0.25];
  const lefts = concept === "split" ? [undefined, 0.35, 0.5, 0.65, 0.3, 0.7] : [undefined];
  const fitsFor: Fit[] = concept.startsWith("hall")
    ? [{}]
    : [false, true].flatMap((compact) =>
        (["hall", "gallery"] as const).flatMap((wing) => shares.flatMap((share) => lefts.map((left) => ({ share, left, wing, compact })))),
      );
  const fits = fitsFor.map((f) => ({ ...f, deep, rows: tweaks.rows }));
  const stairs = program.floors > 1;
  let front: number;
  try {
    front = frontDepth(program.rooms.filter((r) => r.floor === 0), frame.depth, VARIANTS[concept === "hall-garden" ? 1 : 0]);
  } catch (e) {
    why.push(e instanceof Error ? e.message : String(e));
    return null;
  }
  const floors: Floor[] = [];
  for (let level = 0; level < program.floors; level++) {
    const rooms = program.rooms.filter((r) => r.floor === level);
    let found: Floor | null = null;
    let bestScore = Infinity;
    for (const fit of fits) {
      const label = `floor ${level} ${fit.compact ? "compact " : ""}${fit.wing ?? ""} ${fit.share ?? "auto"}/${fit.left ?? "auto"}`;
      try {
        let f = PLANS[concept](level, rooms, frame, stairs, front, fit);
        if (tweaks.closedKitchen) f = { ...f, spaces: f.spaces.map((s) => (s.kind === "kitchen" ? { ...s, open: false } : s)) };
        const errors = validate({ spaceType: program.spaceType, shell: frame, floors: [f] });
        if (!errors.length) {
          if (!tweaks.prefer) {
            found = f;
            break;
          }
          const placed = deep ? transpose({ spaceType: program.spaceType, shell: frame, floors: [f] }, shell).floors[0] : f;
          const score = tweaks.prefer(placed);
          if (score < bestScore) {
            bestScore = score;
            found = f;
          }
          if (score === 0) break;
          continue;
        }
        why.push(`${label}: ${errors.slice(0, 3).join("; ")}`);
      } catch (e) {
        why.push(`${label}: ${e instanceof Error ? e.message : e}`); // this split doesn't fit; try the next
      }
    }
    // The concept is about how the ground floor lives. A bedroom floor above that can't take the open band
    // falls back to a plain hall with rooms on both sides, as most two-storey homes have.
    if (!found && level > 0 && !concept.startsWith("hall")) {
      try {
        const f = PLANS["hall-street"](level, rooms, frame, stairs, front, {});
        if (!validate({ spaceType: program.spaceType, shell: frame, floors: [f] }).length) found = f;
      } catch (e) {
        why.push(`floor ${level} hall fallback: ${e instanceof Error ? e.message : e}`);
      }
    }
    if (!found) return null;
    floors.push(found);
  }
  const layout: Layout = { spaceType: program.spaceType, shell: frame, floors };
  const out = deep ? transpose(layout, shell) : layout;
  const errors = validate(out);
  if (errors.length) {
    why.push(...errors);
    return null;
  }
  return out;
}

export { STAIR_RUN };
