// Draws every layout concept for one template side by side as an HTML sheet, to eyeball the engine.
// Run: node scripts/concept-sheet.ts house out.html
import { writeFileSync } from "node:fs";
import { CONCEPT_IDS, CONCEPT_NAMES, placeConcept } from "../lib/layout/concepts.ts";
import { buildingShell } from "../lib/layout/footprint.ts";
import { DEFAULT_SHELLS, TEMPLATES } from "../lib/layout/templates.ts";
import { wallPieces } from "../lib/layout/walls.ts";
import type { Floor, Layout } from "../lib/layout/schema.ts";

const [type = "house", out = "concepts.html"] = process.argv.slice(2);
const program = TEMPLATES[type as keyof typeof TEMPLATES];
const shell = buildingShell(program, DEFAULT_SHELLS[program.spaceType]);
const FILL: Record<string, string> = { public: "#e8f0fd", private: "#eef6ee", service: "#f4f1ea", circulation: "#f2f3f5" };

function floorSvg(l: Layout, f: Floor) {
  const s = 26;
  const { width: W, depth: D } = l.shell;
  const rooms = f.spaces
    .map((sp) => `<rect x="${sp.rect.x * s}" y="${sp.rect.y * s}" width="${sp.rect.w * s}" height="${sp.rect.h * s}" fill="${FILL[sp.zone]}"/>` +
      `<text x="${(sp.rect.x + sp.rect.w / 2) * s}" y="${(sp.rect.y + sp.rect.h / 2) * s}" font-size="10" text-anchor="middle">${sp.name}</text>`)
    .join("");
  const walls = wallPieces(f, l.shell)
    .map((p) => {
      const [x1, y1, x2, y2] = p.axis === "x" ? [p.from, p.at, p.to, p.at] : [p.at, p.from, p.at, p.to];
      return `<line x1="${x1 * s}" y1="${y1 * s}" x2="${x2 * s}" y2="${y2 * s}" stroke="${p.open ? "#9aa" : "#123"}" stroke-width="${p.open ? 1 : 3}" ${p.open ? 'stroke-dasharray="4 3"' : ""}/>`;
    })
    .join("");
  const doors = f.openings
    .filter((o) => o.type === "door")
    .map((o) => `<circle cx="${o.x * s}" cy="${o.y * s}" r="${o.id === "door-entry" ? 6 : 3}" fill="${o.id === "door-entry" ? "#e11" : "#2f6fed"}"/>`)
    .join("");
  return `<svg width="${W * s + 10}" height="${D * s + 10}" viewBox="-5 -5 ${W * s + 10} ${D * s + 10}">${rooms}${walls}${doors}</svg>`;
}

const cols = CONCEPT_IDS.map((c) => {
  const l = placeConcept(program, shell, c);
  const body = l ? l.floors.map((f) => `<p>Floor ${f.level}</p>${floorSvg(l, f)}`).join("") : "<p>doesn't fit</p>";
  return `<div><h2>${CONCEPT_NAMES[c]}</h2>${body}</div>`;
}).join("");
writeFileSync(out, `<!doctype html><meta charset="utf-8"><title>Concepts: ${type}</title><body style="font-family:sans-serif;display:flex;gap:28px;flex-wrap:wrap;padding:16px"><p style="width:100%">${type}, ${shell.width} by ${shell.depth} m. Front (street) is the top edge. Red dot is the front door. Dashed lines are open plan.</p>${cols}</body>`);
console.log("wrote", out);
