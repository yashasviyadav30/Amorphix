import type { Layout, Opening } from "../layout/schema.ts";
import { DOOR_H, SILL, STOREY, WALL_H } from "../three/geometry.ts";
import { doorIsOpen, wallPieces } from "../layout/walls.ts";
import { PLAIN, roofOutline, type Exterior } from "../three/exterior.ts";

// The drawings pack, as numbers every drawing shares (the screen, the PDF and the DXF): the door and window
// schedule with a tag for each opening, and the four elevations with their openings in place. Heights are the
// same ones the 3D uses, so the drawings and the walkthrough agree. All in metres.


/** The top of the walls: the last storey's walls, as built in the 3D. */
export const wallTop = (layout: Layout) => (layout.floors.length - 1) * STOREY + WALL_H;

export type Tagged = { tag: string; id: string; type: "door" | "window"; level: number; between: [string, string]; width: number; height: number; sill: number };

const NEAR = 0.3; // how close to the shell line an opening must sit to be on the outside wall

/**
 * Every real door and window, tagged D01, D02 and W01, W02 in reading order (floor, then front to back, then left
 * to right). Wide openings drawn without a door leaf on the plan are passages, not doors, and are left out.
 */
export function schedule(layout: Layout): { doors: Tagged[]; windows: Tagged[] } {
  const rows: Omit<Tagged, "tag">[] = [];
  for (const f of [...layout.floors].sort((a, b) => a.level - b.level)) {
    const pieces = wallPieces(f, layout.shell);
    const name = new Map(f.spaces.map((s) => [s.id, s.name]));
    const say = (id: string) => (id === "outside" ? "Outside" : (name.get(id) ?? id));
    const sorted = [...f.openings].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const o of sorted) {
      if (doorIsOpen(o, pieces)) continue;
      const door = o.type === "door";
      rows.push({ id: o.id, type: o.type, level: f.level, between: [say(o.between[0]), say(o.between[1])], width: o.width, height: door ? DOOR_H : DOOR_H - SILL, sill: door ? 0 : SILL });
    }
  }
  const tagAll = (type: "door" | "window", p: string) =>
    rows.filter((r) => r.type === type).map((r, i) => ({ ...r, tag: `${p}${String(i + 1).padStart(2, "0")}` }));
  return { doors: tagAll("door", "D"), windows: tagAll("window", "W") };
}

export type Side = "front" | "back" | "left" | "right";
export const SIDES: { side: Side; name: string }[] = [
  { side: "front", name: "Street side" },
  { side: "back", name: "Back" },
  { side: "left", name: "Left side" },
  { side: "right", name: "Right side" },
];

export type Elevation = {
  side: Side;
  length: number; // along the wall, as the viewer sees it, left to right
  top: number; // top of the walls
  floors: number[]; // the height of each floor level
  openings: { tag: string; type: "door" | "window"; t0: number; t1: number; y0: number; y1: number }[];
  /** The roof as seen from this side, and any wall above the wall tops (a gable end), as [t, y] outlines. */
  roof: [number, number][];
  infill: [number, number][] | null;
  /** The highest point drawn. */
  high: number;
};

function onSide(o: Opening, side: Side, W: number, D: number) {
  if (!o.between.includes("outside")) return false;
  if (side === "front") return o.axis === "x" && Math.abs(o.y) < NEAR;
  if (side === "back") return o.axis === "x" && Math.abs(o.y - D) < NEAR;
  if (side === "left") return o.axis === "y" && Math.abs(o.x) < NEAR;
  return o.axis === "y" && Math.abs(o.x - W) < NEAR;
}

/** Where along the wall an opening sits, as seen standing outside facing that wall. */
function along(o: Opening, side: Side, W: number, D: number) {
  if (side === "front") return o.x;
  if (side === "back") return W - o.x;
  if (side === "left") return D - o.y;
  return o.y;
}

/** One side of the building as seen from outside, with every outside door and window on it. */
export function elevation(layout: Layout, side: Side, tags = schedule(layout), ex: Exterior = PLAIN): Elevation {
  const { width: W, depth: D } = layout.shell;
  const tagOf = new Map([...tags.doors, ...tags.windows].map((t) => [`${t.level}:${t.id}`, t.tag]));
  const openings: Elevation["openings"] = [];
  for (const f of layout.floors) {
    const base = f.level * STOREY;
    for (const o of f.openings) {
      const tag = tagOf.get(`${f.level}:${o.id}`);
      if (!tag || !onSide(o, side, W, D)) continue;
      const c = along(o, side, W, D);
      const door = o.type === "door";
      openings.push({ tag, type: o.type, t0: c - o.width / 2, t1: c + o.width / 2, y0: base + (door ? 0 : SILL), y1: base + DOOR_H });
    }
  }
  const top = wallTop(layout);
  const { roof, infill } = roofOutline(ex, W, D, top, side);
  return {
    side,
    length: side === "front" || side === "back" ? W : D,
    top,
    roof,
    infill,
    high: Math.max(top, ...roof.map((p) => p[1])),
    floors: layout.floors.map((f) => f.level * STOREY).sort((a, b) => a - b),
    openings: openings.sort((a, b) => a.y0 - b.y0 || a.t0 - b.t0),
  };
}

const FT = 3.28084;
/** An area in the plan's units: "306 sq ft" or "28 m²". */
export const sayArea = (m2: number, units: "imperial" | "metric") => (units === "imperial" ? `${Math.round(m2 * FT * FT).toLocaleString()} sq ft` : `${Math.round(m2)} m²`);

/** A length on a drawing: "12.40 m", or feet and inches ("40' 8\"") for imperial plans. */
export function sayLength(m: number, units: "imperial" | "metric") {
  if (units === "metric") return `${m.toFixed(2)} m`;
  const inches = Math.round(m * FT * 12);
  return `${Math.floor(inches / 12)}' ${inches % 12}"`;
}
