import { test } from "node:test";
import assert from "node:assert/strict";
import { doorIsOpen, isOpen, wallPieces } from "./walls.ts";
import { planOptions } from "./place.ts";
import { buildingShell } from "./footprint.ts";
import { DEFAULT_SHELLS, TEMPLATES } from "./templates.ts";
import type { Floor, Rect } from "./schema.ts";

const house = planOptions(TEMPLATES.house, buildingShell(TEMPLATES.house, DEFAULT_SHELLS.house));

// Does any solid wall piece run along the edge two rects share?
function solidBetween(floor: Floor, shellW: number, shellD: number, a: Rect, b: Rect) {
  const pieces = wallPieces(floor, { width: shellW, depth: shellD });
  return pieces.some((p) => {
    if (p.open) return false;
    if (p.axis === "x") {
      const line = Math.abs(a.y + a.h - b.y) < 1e-6 ? b.y : Math.abs(b.y + b.h - a.y) < 1e-6 ? a.y : null;
      if (line === null || Math.abs(p.at - line) > 1e-6) return false;
      return Math.min(p.to, a.x + a.w, b.x + b.w) - Math.max(p.from, a.x, b.x) > 1e-6;
    }
    const line = Math.abs(a.x + a.w - b.x) < 1e-6 ? b.x : Math.abs(b.x + b.w - a.x) < 1e-6 ? a.x : null;
    if (line === null || Math.abs(p.at - line) > 1e-6) return false;
    return Math.min(p.to, a.y + a.h, b.y + b.h) - Math.max(p.from, a.y, b.y) > 1e-6;
  });
}

test("living, dining, kitchen and hall open into each other", () => {
  for (const layout of house) {
    const f = layout.floors[0];
    const open = f.spaces.filter(isOpen);
    assert.ok(open.some((s) => s.kind === "living") && open.some((s) => s.kind === "corridor"));
    for (let i = 0; i < open.length; i++)
      for (let j = i + 1; j < open.length; j++)
        assert.ok(!solidBetween(f, layout.shell.width, layout.shell.depth, open[i].rect, open[j].rect), `${open[i].id} | ${open[j].id}`);
  }
});

test("bedrooms, baths and offices stay enclosed", () => {
  for (const layout of house)
    for (const f of layout.floors)
      for (const s of f.spaces.filter((s) => ["bedroom", "bath", "office"].includes(s.kind))) {
        const pieces = wallPieces(f, layout.shell);
        const { x, y, w, h } = s.rect;
        const onMyEdge = (p: (typeof pieces)[number]) =>
          (p.axis === "x" && (Math.abs(p.at - y) < 1e-6 || Math.abs(p.at - (y + h)) < 1e-6) && p.from < x + w - 1e-6 && p.to > x + 1e-6) ||
          (p.axis === "z" && (Math.abs(p.at - x) < 1e-6 || Math.abs(p.at - (x + w)) < 1e-6) && p.from < y + h - 1e-6 && p.to > y + 1e-6);
        assert.ok(!pieces.some((p) => p.open && onMyEdge(p)), `${s.id} has no open side`);
      }
});

test("exterior walls are never opened", () => {
  for (const layout of house)
    for (const f of layout.floors) assert.ok(!wallPieces(f, layout.shell).some((p) => p.open && p.exterior));
});

test("doors between open areas disappear; doors into closed rooms stay", () => {
  const layout = house[0];
  const f = layout.floors[0];
  const pieces = wallPieces(f, layout.shell);
  const byId = new Map(f.spaces.map((s) => [s.id, s]));
  for (const o of f.openings.filter((o) => o.type === "door" && o.id !== "door-entry")) {
    const both = o.between.every((id) => byId.get(id) && isOpen(byId.get(id)!));
    assert.equal(doorIsOpen(o, pieces), both, o.id);
  }
});
