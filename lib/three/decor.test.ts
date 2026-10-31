import { test } from "node:test";
import assert from "node:assert/strict";
import { decorate } from "./decor.ts";
import { planOptions } from "../layout/place.ts";
import { planOptionsFor } from "../design/options.ts";
import { buildingShell } from "../layout/footprint.ts";
import { DEFAULT_SHELLS, TEMPLATES } from "../layout/templates.ts";
import { wallPieces } from "../layout/walls.ts";
import { DOOR_H, SILL, STOREY } from "./geometry.ts";

const layouts = Object.values(TEMPLATES).flatMap((p) => planOptions(p, buildingShell(p, DEFAULT_SHELLS[p.spaceType])));
const house = planOptions(TEMPLATES.house, buildingShell(TEMPLATES.house, DEFAULT_SHELLS.house))[0];

// The span an item covers along its wall, in world terms.
const span = (it: { x: number; z: number; w: number; d: number }, axis: "x" | "z") => (axis === "x" ? [it.x - it.w / 2, it.x + it.w / 2] : [it.z - it.d / 2, it.z + it.d / 2]);

test("wall dressing never covers a door, and covers a window only below the sill or above the head", () => {
  for (const layout of layouts)
    for (const it of decorate(layout).filter((i) => i.name !== "curtain" && i.name !== "curtain rod")) {
      const f = layout.floors[it.level];
      const axis = it.w > it.d ? "x" : "z";
      const [a, b] = span(it, axis);
      const y0 = it.y - it.level * STOREY;
      const y1 = y0 + it.h;
      for (const o of f.openings.filter((o) => o.axis === axis)) {
        const lineAt = axis === "x" ? o.y : o.x;
        const off = Math.abs((axis === "x" ? it.z : it.x) - lineAt);
        if (off > 0.2) continue; // a different wall
        const c = axis === "x" ? o.x : o.y;
        const overlap = Math.min(b, c + o.width / 2) - Math.max(a, c - o.width / 2);
        if (overlap <= 1e-6) continue;
        assert.equal(o.type, "window", `${layout.spaceType}/${it.room}/${it.name} covers door ${o.id}`);
        assert.ok(y1 <= SILL + 1e-6 || y0 >= DOOR_H - 1e-6, `${layout.spaceType}/${it.room}/${it.name} covers window ${o.id}`);
      }
    }
});

test("an open-plan side gets no wall dressing", () => {
  // The house's living room opens to the kitchen: none of the feature wall may sit on that open edge.
  const f = house.floors[0];
  const open = wallPieces(f, house.shell).filter((p) => p.open);
  for (const it of decorate(house).filter((i) => i.level === 0 && i.name === "feature wall")) {
    const axis = it.w > it.d ? "x" : "z";
    const [a, b] = span(it, axis);
    for (const p of open.filter((p) => p.axis === axis && Math.abs(p.at - (axis === "x" ? it.z : it.x)) < 0.2))
      assert.ok(Math.min(b, p.to) - Math.max(a, p.from) <= 1e-6, `${it.room} feature wall on an open edge`);
  }
});

test("living rooms and bedrooms get art and curtains; kitchens a backsplash; baths tile", () => {
  const items = decorate(house);
  const has = (room: string, name: string) => items.some((i) => i.room === room && i.name === name);
  assert.ok(has("living", "art") && has("living", "curtain"));
  assert.ok(has("primary", "art") && has("primary", "feature wall"));
  assert.ok(has("kitchen", "backsplash"));
  assert.ok(items.some((i) => i.name === "tile"));
});

test("every piece of art sits within its room's walls", () => {
  for (const layout of layouts)
    for (const it of decorate(layout).filter((i) => i.name === "art")) {
      const r = layout.floors[it.level].spaces.find((s) => s.id === it.room)!.rect;
      assert.ok(it.x >= r.x - 1e-6 && it.x <= r.x + r.w + 1e-6 && it.z >= r.y - 1e-6 && it.z <= r.y + r.h + 1e-6, `${it.room} art`);
    }
});

test("panelling and every other wall dressing leave every doorway clear, on walls along both axes", () => {
  // the concept plans put doors on walls running both ways (a dining room opening off the side, say)
  const concepts = Object.values(TEMPLATES).flatMap((t) => planOptionsFor(t, buildingShell(t, DEFAULT_SHELLS[t.spaceType]), { space_type: t.spaceType }));
  for (const layout of [...layouts, ...concepts])
    for (const f of layout.floors)
      for (const o of f.openings.filter((o) => o.type === "door"))
        for (const i of decorate(layout).filter((i) => i.level === f.level && i.y - f.level * STOREY < DOOR_H - 0.01))
          assert.ok(!(o.axis === "x" ? Math.abs(i.z - o.y) < 0.3 && Math.abs(i.x - o.x) < i.w / 2 - 0.05 : Math.abs(i.x - o.x) < 0.3 && Math.abs(i.z - o.y) < i.d / 2 - 0.05), `${i.name} across ${o.id}`);
});
