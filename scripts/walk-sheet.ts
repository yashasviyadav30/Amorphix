// Draws a project's plan options from above: rooms, walls, doors, every piece of furniture, and the walkthrough
// route as a line, one floor at a time. For checking by eye that furniture sits on walls and the walk stays inside.
// Run: node --env-file=.env.local --env-file=.env scripts/walk-sheet.ts <projectId | template name> out.html
import { writeFileSync } from "node:fs";
import { getProject } from "../lib/project/store.ts";
import { planOptionsFor } from "../lib/design/options.ts";
import { buildingShell } from "../lib/layout/footprint.ts";
import { DEFAULT_SHELLS, TEMPLATES } from "../lib/layout/templates.ts";
import { wallPieces } from "../lib/layout/walls.ts";
import { furnish } from "../lib/three/furniture.ts";
import { STOREY, walkPlan, EYE } from "../lib/three/geometry.ts";
import type { Floor, Layout } from "../lib/layout/schema.ts";

const [id, out = "walk.html"] = process.argv.slice(2);
// A template name (house, cafe, office...) draws that template's three plans; anything else is a project id.
const template = TEMPLATES[id as keyof typeof TEMPLATES];
const p = template
  ? { options: planOptionsFor(template, buildingShell(template, DEFAULT_SHELLS[template.spaceType]), { space_type: template.spaceType }) }
  : await getProject(id);
const s = 30;

function floorSvg(l: Layout, f: Floor) {
  const { width: W, depth: D } = l.shell;
  const rooms = f.spaces
    .map((sp) => `<rect x="${sp.rect.x * s}" y="${sp.rect.y * s}" width="${sp.rect.w * s}" height="${sp.rect.h * s}" fill="${sp.zone === "circulation" ? "#eef0f3" : "#fbfaf7"}"/><text x="${(sp.rect.x + 0.15) * s}" y="${(sp.rect.y + 0.45) * s}" font-size="10" fill="#678">${sp.name}</text>`)
    .join("");
  const walls = wallPieces(f, l.shell)
    .map((q) => {
      const [x1, y1, x2, y2] = q.axis === "x" ? [q.from, q.at, q.to, q.at] : [q.at, q.from, q.at, q.to];
      return `<line x1="${x1 * s}" y1="${y1 * s}" x2="${x2 * s}" y2="${y2 * s}" stroke="${q.open ? "#bcc" : "#123"}" stroke-width="${q.open ? 1 : 4}" ${q.open ? 'stroke-dasharray="4 3"' : ""}/>`;
    })
    .join("");
  const openings = f.openings
    .map((o) => {
      const [x1, y1, x2, y2] = o.axis === "x" ? [o.x - o.width / 2, o.y, o.x + o.width / 2, o.y] : [o.x, o.y - o.width / 2, o.x, o.y + o.width / 2];
      return `<line x1="${x1 * s}" y1="${y1 * s}" x2="${x2 * s}" y2="${y2 * s}" stroke="${o.type === "window" ? "#7ab8f5" : o.id === "door-entry" ? "#e11" : "#fff"}" stroke-width="5"/>`;
    })
    .join("");
  const items = furnish(l)
    .filter((it) => it.level === f.level && !["rug"].includes(it.name))
    .map((it) => `<rect x="${(it.x - it.w / 2) * s}" y="${(it.z - it.d / 2) * s}" width="${it.w * s}" height="${it.d * s}" fill="#c98b5a55" stroke="#8a5a33"/><text x="${it.x * s}" y="${it.z * s + 3}" font-size="7" text-anchor="middle">${it.name}</text>`)
    .join("");
  const walk = walkPlan(l);
  const level = (y: number) => Math.round((y - EYE) / STOREY);
  const pts = walk.path.filter((q) => level(q[1]) === f.level || (f.level === 0 && q[1] < EYE + 0.01));
  const line = `<polyline points="${pts.map((q) => `${q[0] * s},${q[2] * s}`).join(" ")}" fill="none" stroke="#2f6fed" stroke-width="2" opacity="0.8"/>`;
  const stops = walk.stops.filter((q) => level(q[1]) === f.level).map((q, i) => `<circle cx="${q[0] * s}" cy="${q[2] * s}" r="5" fill="#2f5d45"/><text x="${q[0] * s + 7}" y="${q[2] * s}" font-size="9" fill="#2f5d45">${i + 1}</text>`).join("");
  return `<svg width="${W * s + 160}" height="${D * s + 160}" viewBox="${-80} ${-80} ${W * s + 160} ${D * s + 160}">${rooms}${items}${walls}${openings}${line}${stops}</svg>`;
}

const cols = (p.options ?? [])
  .map((l, i) => `<div><h2>${i + 1}. ${l.concept?.name ?? ""}</h2>${l.floors.map((f) => `<p>Floor ${f.level}</p>${floorSvg(l, f)}`).join("")}</div>`)
  .join("");
writeFileSync(out, `<!doctype html><meta charset="utf-8"><title>Walk sheet</title><body style="font-family:sans-serif;display:flex;gap:20px;flex-wrap:wrap;padding:12px"><p style="width:100%">Blue line: the walkthrough route. Green dots: where it stops to look. Red: front door. Light blue: windows. Brown boxes: furniture. Street is the top edge.</p>${cols}</body>`);
console.log("wrote", out);
