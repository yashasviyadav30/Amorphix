import type { Floor, Opening, Shell, Space } from "./schema.ts";

// Where walls stand on a floor, shared by the 2D plan and the 3D model.
// Living, dining and kitchen areas open into each other and the hall, like a modern open-plan home;
// bedrooms, baths and offices stay enclosed. Door records stay, so the layout validator is unchanged.

const OPEN_KINDS = new Set(["living", "dining", "kitchen", "lounge", "reception", "retail", "counter", "corridor"]);
export const isOpen = (s: Space) => s.open ?? (OPEN_KINDS.has(s.kind) && (s.zone === "public" || s.zone === "circulation"));

const EPS = 1e-6;
export type Piece = { axis: "x" | "z"; at: number; from: number; to: number; exterior: boolean; open: boolean };

type Span = [number, number];

function union(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const out: Span[] = [];
  for (const [a, b] of sorted) {
    const last = out.at(-1);
    if (last && a <= last[1] + EPS) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

// Edges of each space, keyed by the line they lie on: "x:<z>" runs along x at that z, "z:<x>" along z at that x.
function edges(s: Space): { key: string; at: number; span: Span }[] {
  const { x, y, w, h } = s.rect;
  return [
    { key: `x:${y.toFixed(4)}`, at: y, span: [x, x + w] },
    { key: `x:${(y + h).toFixed(4)}`, at: y + h, span: [x, x + w] },
    { key: `z:${x.toFixed(4)}`, at: x, span: [y, y + h] },
    { key: `z:${(x + w).toFixed(4)}`, at: x + w, span: [y, y + h] },
  ];
}

// The stretches of each line shared by two open spaces: no wall stands there.
function openSpans(spaces: Space[]): Map<string, Span[]> {
  const open = spaces.filter(isOpen);
  const out = new Map<string, Span[]>();
  for (let i = 0; i < open.length; i++)
    for (let j = i + 1; j < open.length; j++)
      for (const a of edges(open[i]))
        for (const b of edges(open[j])) {
          if (a.key !== b.key) continue;
          const lo = Math.max(a.span[0], b.span[0]);
          const hi = Math.min(a.span[1], b.span[1]);
          if (hi - lo > EPS) out.set(a.key, [...(out.get(a.key) ?? []), [lo, hi]]);
        }
  return out;
}

// Every wall line on the floor, split into solid pieces and open stretches.
export function wallPieces(floor: Floor, shell: Shell): Piece[] {
  // The key groups edges on the same line; the position keeps its exact value so doors match it.
  const lines = new Map<string, { at: number; spans: Span[] }>();
  for (const s of floor.spaces)
    for (const e of edges(s)) {
      const line = lines.get(e.key) ?? { at: e.at, spans: [] };
      line.spans.push(e.span);
      lines.set(e.key, line);
    }
  const opens = openSpans(floor.spaces);
  const pieces: Piece[] = [];
  for (const [key, { at, spans }] of lines) {
    const axis = key.split(":")[0] as "x" | "z";
    const exterior = (axis === "x" && (Math.abs(at) < EPS || Math.abs(at - shell.depth) < EPS)) || (axis === "z" && (Math.abs(at) < EPS || Math.abs(at - shell.width) < EPS));
    const gaps = union(opens.get(key) ?? []);
    for (const [a, b] of union(spans)) {
      let cursor = a;
      for (const [g0, g1] of gaps) {
        if (g1 <= cursor + EPS || g0 >= b - EPS) continue;
        if (g0 > cursor + EPS) pieces.push({ axis, at, from: cursor, to: g0, exterior, open: false });
        pieces.push({ axis, at, from: Math.max(cursor, g0), to: Math.min(b, g1), exterior, open: true });
        cursor = Math.min(b, g1);
      }
      if (b > cursor + EPS) pieces.push({ axis, at, from: cursor, to: b, exterior, open: false });
    }
  }
  return pieces;
}

// A door that sits in an open stretch isn't built or drawn: the rooms simply flow into each other.
export function doorIsOpen(o: Opening, pieces: Piece[]): boolean {
  if (o.type !== "door") return false;
  const axis = o.axis === "x" ? "x" : "z";
  const at = o.axis === "x" ? o.y : o.x;
  const c = o.axis === "x" ? o.x : o.y;
  return pieces.some((p) => p.open && p.axis === axis && Math.abs(p.at - at) < 1e-4 && c >= p.from - EPS && c <= p.to + EPS);
}
