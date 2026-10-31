import type { Layout } from "../layout/schema.ts";
import type { Look, Style } from "./materials.ts";

// The outside of a house, chosen from taste: the roof's shape, what the walls are clad in, and a planted garden.
// One description that the 3D, the elevations and the DXF all draw from, so they always agree. A fit-out keeps
// its roof (we don't rebuild it), businesses and flats keep the plain flat roof, and nothing is shown as taste
// unless a place or brand the client named is behind it. All in metres; x across the street side, z front to back.

export type Roof = "flat" | "gable" | "hip" | "shed";
export type Cladding = "render" | "brick" | "timber";
export type Exterior = { roof: Roof; pitch: number; overhang: number; cladding: Cladding; garden: boolean; because: string[] };

export const ROOF_T = 0.3; // roof thickness, as before
export const PLAIN: Exterior = { roof: "flat", pitch: 0, overhang: 0.3, cladding: "render", garden: false, because: [] };

const ROOF_OF: Record<Style, Roof> = { scandi: "gable", boho: "gable", classic: "hip", midcentury: "shed", industrial: "flat", modern: "flat" };
const PITCH: Record<Roof, number> = { flat: 0, gable: 35, hip: 28, shed: 10 };
// A classic taste gets smooth warm render (an LA Spanish-colonial or Hollywood Regency house, like Chateau Marmont),
// not brick: brick is for an industrial taste, or when the brief asks for it.
const CLAD_OF: Record<Style, Cladding> = { scandi: "timber", midcentury: "timber", industrial: "brick", classic: "render", boho: "render", modern: "render" };
const OVERHANG: Record<Roof, number> = { flat: 0.3, gable: 0.5, hip: 0.5, shed: 0.6 };

/** The exterior for a design, from the look the 3D already reads off the client's taste. */
export function exteriorOf(layout: Layout, look: Pick<Look, "style" | "finish" | "lush" | "because">, newBuild: boolean): Exterior {
  if (layout.spaceType !== "house" || !look.because.length) return PLAIN;
  const roof = newBuild ? ROOF_OF[look.style] : "flat";
  const cladding = look.finish === "brick" ? "brick" : CLAD_OF[look.style];
  return { roof, pitch: roof === "gable" && look.style === "boho" ? 25 : PITCH[roof], overhang: OVERHANG[roof], cladding, garden: look.lush, because: look.because };
}

const NAMES: Record<Roof, string> = { flat: "a flat roof", gable: "a pitched gable roof", hip: "a hipped roof", shed: "a single-slope roof" };
/** "A pitched gable roof, timber cladding and a planted garden", for the source line under the 3D. */
export function sayExterior(e: Exterior) {
  const parts = [NAMES[e.roof], `${e.cladding} walls`, e.garden && "a planted garden"].filter(Boolean) as string[];
  const s = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  return s[0].toUpperCase() + s.slice(1);
}

/** Pitched roofs run their ridge along the longer side; a single slope always rises from the street to the back. */
export function ridgeAlongX(e: Exterior, W: number, D: number) {
  return e.roof === "shed" || W >= D;
}

/** How far the roof rises above the wall top at its highest point. */
export function rise(e: Exterior, W: number, D: number) {
  const t = Math.tan((e.pitch * Math.PI) / 180);
  if (e.roof === "flat") return 0;
  if (e.roof === "shed") return D * t;
  return ((ridgeAlongX(e, W, D) ? D : W) / 2) * t;
}

type P3 = [number, number, number];

/**
 * The roof and the wall infill under it (gable ends, the tall wall of a single slope), as triangles for the 3D.
 * `top` is the height of the wall tops. Each triangle is three [x, y, z] points.
 */
export function roofShape(e: Exterior, W: number, D: number, top: number): { roof: P3[][]; infill: P3[][] } {
  if (e.roof === "flat") return { roof: [], infill: [] };
  const o = e.overhang;
  const t = Math.tan((e.pitch * Math.PI) / 180);
  const alongX = ridgeAlongX(e, W, D);
  const [L, S] = alongX ? [W, D] : [D, W]; // along the ridge, across it
  // Local (u along the ridge, v across it) to world.
  const at = (u: number, y: number, v: number): P3 => (alongX ? [u, y, v] : [v, y, u]);
  const quad = (a: P3, b: P3, c: P3, d: P3) => [[a, b, c], [a, c, d]];
  if (e.roof === "shed") {
    const yLow = top - o * t;
    const yHigh = top + (S + o) * t;
    const r = S * t;
    return {
      roof: quad(at(-o, yLow, -o), at(L + o, yLow, -o), at(L + o, yHigh, S + o), at(-o, yHigh, S + o)),
      // The two side walls get a sloped triangle, the back wall rises the full height.
      infill: [[at(0, top, 0), at(0, top, S), at(0, top + r, S)], [at(L, top, 0), at(L, top, S), at(L, top + r, S)], ...quad(at(0, top, S), at(L, top, S), at(L, top + r, S), at(0, top + r, S))],
    };
  }
  const yE = top - o * t; // the eave, where the roof ends past the wall
  const yR = top + (S / 2) * t; // the ridge
  if (e.roof === "gable") {
    return {
      roof: [...quad(at(-o, yE, -o), at(L + o, yE, -o), at(L + o, yR, S / 2), at(-o, yR, S / 2)), ...quad(at(-o, yE, S + o), at(L + o, yE, S + o), at(L + o, yR, S / 2), at(-o, yR, S / 2))],
      infill: [[at(0, top, 0), at(0, top, S), at(0, yR, S / 2)], [at(L, top, 0), at(L, top, S), at(L, yR, S / 2)]],
    };
  }
  // Hip: slopes on all four sides, the ridge shortened by half the span at each end (a pyramid on a square).
  const r0 = Math.min(S / 2, L / 2);
  const r1 = Math.max(L - S / 2, L / 2);
  return {
    roof: [
      ...quad(at(-o, yE, -o), at(L + o, yE, -o), at(r1, yR, S / 2), at(r0, yR, S / 2)),
      ...quad(at(-o, yE, S + o), at(L + o, yE, S + o), at(r1, yR, S / 2), at(r0, yR, S / 2)),
      [at(-o, yE, -o), at(-o, yE, S + o), at(r0, yR, S / 2)],
      [at(L + o, yE, -o), at(L + o, yE, S + o), at(r1, yR, S / 2)],
    ],
    infill: [],
  };
}

type P2 = [number, number];

/**
 * The roof and any wall above the wall tops, as seen on one elevation (t across the drawing from the viewer's left,
 * y up). Front and back look along z; the sides look along x, with the back of the house on the left of the left
 * side and on the right of the right side.
 */
export function roofOutline(e: Exterior, W: number, D: number, top: number, side: "front" | "back" | "left" | "right"): { roof: P2[]; infill: P2[] | null } {
  const facing = side === "front" || side === "back";
  const len = facing ? W : D;
  const o = e.overhang;
  if (e.roof === "flat") return { roof: [[-o, top], [len + o, top], [len + o, top + ROOF_T], [-o, top + ROOF_T]], infill: null };
  const t = Math.tan((e.pitch * Math.PI) / 180);
  const alongX = ridgeAlongX(e, W, D);
  const eaveSide = facing === alongX; // looking at the long slope rather than the end
  const S = alongX ? D : W;
  if (e.roof === "shed") {
    const yLow = top - o * t;
    const yHigh = top + (S + o) * t;
    const r = S * t;
    if (side === "front") return { roof: [[-o, yLow], [len + o, yLow], [len + o, yHigh], [-o, yHigh]], infill: null };
    if (side === "back") return { roof: [[-o, yHigh], [len + o, yHigh], [len + o, yHigh + ROOF_T], [-o, yHigh + ROOF_T]], infill: [[0, top], [len, top], [len, top + r], [0, top + r]] };
    // The sides: the back of the house is on the left of the left side.
    const hi = side === "left" ? 0 : len;
    const lo = len - hi;
    const sgn = hi === 0 ? -1 : 1;
    return {
      roof: [[lo - sgn * o, yLow], [hi + sgn * o, yHigh], [hi + sgn * o, yHigh + ROOF_T], [lo - sgn * o, yLow + ROOF_T]],
      infill: [[lo, top], [hi, top], [hi, top + r]],
    };
  }
  const yE = top - o * t;
  const yR = top + (S / 2) * t;
  if (eaveSide) {
    if (e.roof === "gable") return { roof: [[-o, yE], [len + o, yE], [len + o, yR], [-o, yR]], infill: null };
    const r0 = Math.min(S / 2, len / 2);
    const r1 = Math.max(len - S / 2, len / 2);
    return { roof: [[-o, yE], [len + o, yE], [r1, yR], [r0, yR]], infill: null };
  }
  if (e.roof === "gable")
    return {
      roof: [[-o, yE], [len / 2, yR], [len + o, yE], [len + o, yE + ROOF_T], [len / 2, yR + ROOF_T], [-o, yE + ROOF_T]],
      infill: [[0, top], [len, top], [len / 2, yR]],
    };
  return { roof: [[-o, yE], [len + o, yE], [len / 2, yR]], infill: null };
}
