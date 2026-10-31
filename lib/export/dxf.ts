import type { Layout } from "../layout/schema.ts";
import { elevation, schedule, SIDES } from "./drawings.ts";
import { PLAIN, type Exterior } from "../three/exterior.ts";

// The drawings as a DXF that architects can open in any CAD program: each floor plan (rooms as closed outlines with
// name and area, doors and windows across the wall with their schedule tags, overall dimensions), the floors side by
// side, and the four elevations in a row underneath. One layer per kind of thing. Plain DXF R12 (LINE and TEXT
// only), in metres, so even old readers open it.

const GAP = 4; // metres between floors laid side by side

function pairs(code: number, value: string | number) {
  return `${code}\n${typeof value === "number" ? +value.toFixed(4) : value}\n`;
}
const line = (layer: string, x1: number, y1: number, x2: number, y2: number) =>
  pairs(0, "LINE") + pairs(8, layer) + pairs(10, x1) + pairs(20, y1) + pairs(30, 0) + pairs(11, x2) + pairs(21, y2) + pairs(31, 0);
const text = (layer: string, x: number, y: number, h: number, value: string) =>
  pairs(0, "TEXT") + pairs(8, layer) + pairs(10, x) + pairs(20, y) + pairs(30, 0) + pairs(40, h) + pairs(1, value.replace(/[\r\n]+/g, " "));

/** The layout as a DXF file. y runs up in CAD, so the street side (y = 0 in the plan) ends up at the bottom. */
export function toDxf(layout: Layout, title: string, ex: Exterior = PLAIN): string {
  const { width: W, depth: D } = layout.shell;
  const tags = schedule(layout);
  const tagOf = new Map([...tags.doors, ...tags.windows].map((t) => [`${t.level}:${t.id}`, t.tag]));
  let body = "";
  const dim = (x1: number, y1: number, x2: number, y2: number, label: string) => {
    body += line("DIMENSIONS", x1, y1, x2, y2);
    const across = x1 === x2;
    for (const [x, y] of [[x1, y1], [x2, y2]]) body += across ? line("DIMENSIONS", x - 0.12, y, x + 0.12, y) : line("DIMENSIONS", x, y - 0.12, x, y + 0.12);
    body += text("DIMENSIONS", across ? x1 - 0.5 : (x1 + x2) / 2 - 0.4, across ? (y1 + y2) / 2 : y1 + 0.15, 0.22, label);
  };
  layout.floors.forEach((f, i) => {
    const ox = i * (W + GAP);
    const flip = (y: number) => D - y;
    body += text("TITLE", ox, D + 1.2, 0.5, `${title} - ${f.level === 0 ? "Ground floor" : "Upstairs"}`);
    body += text("TITLE", ox, -1.2, 0.3, "Made with Amorphix - Spaces designed around who you are");
    // the building outline
    for (const [x1, y1, x2, y2] of [[0, 0, W, 0], [W, 0, W, D], [W, D, 0, D], [0, D, 0, 0]]) body += line("WALLS", ox + x1, y1, ox + x2, y2);
    for (const s of f.spaces) {
      const { x, y, w, h } = s.rect;
      const layer = s.zone === "circulation" ? "CIRCULATION" : "ROOMS";
      for (const [x1, y1, x2, y2] of [[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]]) body += line(layer, ox + x1, flip(y1), ox + x2, flip(y2));
      if (s.zone !== "circulation") {
        const size = Math.max(0.18, Math.min(0.35, w / 12));
        body += text("LABELS", ox + x + 0.2, flip(y + h / 2) + size * 0.6, size, s.name);
        body += text("LABELS", ox + x + 0.2, flip(y + h / 2) - size * 0.8, size * 0.8, `${(w * h).toFixed(1)} m2`);
      }
    }
    for (const o of f.openings) {
      const half = o.width / 2;
      const layer = o.type === "door" ? "DOORS" : "WINDOWS";
      body += o.axis === "x" ? line(layer, ox + o.x - half, flip(o.y), ox + o.x + half, flip(o.y)) : line(layer, ox + o.x, flip(o.y - half), ox + o.x, flip(o.y + half));
      const tag = tagOf.get(`${f.level}:${o.id}`);
      if (tag) body += text("TAGS", ox + o.x + (o.axis === "y" ? 0.25 : -0.2), flip(o.y) - (o.axis === "x" ? 0.45 : 0), 0.2, tag);
    }
    dim(ox, D + 0.5, ox + W, D + 0.5, `${W.toFixed(2)} m`);
    dim(ox - 0.7, 0, ox - 0.7, D, `${D.toFixed(2)} m`);
  });

  // The four elevations in a row under the plans, ground at y = oy.
  const span = Math.max(W, D) + GAP;
  SIDES.forEach(({ side, name }, i) => {
    const e = elevation(layout, side, tags, ex);
    const ox = i * span;
    const oy = -(e.high + 5);
    const L = e.length;
    body += text("TITLE", ox, oy + e.high + 0.6, 0.4, `${title} - ${name} elevation`);
    const outline = (pts: [number, number][]) =>
      pts.forEach(([t, y], k) => {
        const [t2, y2] = pts[(k + 1) % pts.length];
        body += line("ELEVATIONS", ox + t, oy + y, ox + t2, oy + y2);
      });
    body += line("ELEVATIONS", ox - 1, oy, ox + L + 1, oy);
    for (const [x1, y1, x2, y2] of [[0, 0, L, 0], [L, 0, L, e.top], [L, e.top, 0, e.top], [0, e.top, 0, 0]]) body += line("ELEVATIONS", ox + x1, oy + y1, ox + x2, oy + y2);
    outline(e.roof);
    if (e.infill) outline(e.infill);
    for (const f of e.floors.filter((y) => y > 0)) body += line("ELEVATIONS", ox, oy + f, ox + L, oy + f);
    for (const o of e.openings) {
      for (const [x1, y1, x2, y2] of [[o.t0, o.y0, o.t1, o.y0], [o.t1, o.y0, o.t1, o.y1], [o.t1, o.y1, o.t0, o.y1], [o.t0, o.y1, o.t0, o.y0]]) body += line("ELEVATIONS", ox + x1, oy + y1, ox + x2, oy + y2);
      body += text("TAGS", ox + (o.t0 + o.t1) / 2 - 0.2, oy + o.y1 + 0.1, 0.2, o.tag);
    }
    dim(ox, oy - 0.6, ox + L, oy - 0.6, `${L.toFixed(2)} m`);
  });
  // $INSUNITS 6 = metres
  const header = pairs(0, "SECTION") + pairs(2, "HEADER") + pairs(9, "$ACADVER") + pairs(1, "AC1009") + pairs(9, "$INSUNITS") + pairs(70, 6) + pairs(0, "ENDSEC");
  return header + pairs(0, "SECTION") + pairs(2, "ENTITIES") + body + pairs(0, "ENDSEC") + pairs(0, "EOF");
}
