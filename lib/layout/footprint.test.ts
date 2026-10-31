import { test } from "node:test";
import assert from "node:assert/strict";
import { buildingShell, STAIRWELL } from "./footprint.ts";
import { TEMPLATES } from "./templates.ts";

test("a small program on a big lot gets a building sized to its rooms, in the lot's proportions", () => {
  const lot = { width: 12.2, depth: 18.3 };
  const b = buildingShell(TEMPLATES.house, lot);
  const groundArea = TEMPLATES.house.rooms.filter((r) => r.floor === 0).reduce((t, r) => t + r.area, 0);
  const upstairsArea = TEMPLATES.house.rooms.filter((r) => r.floor === 1).reduce((t, r) => t + r.area, 0);
  assert.ok(Math.abs(b.width * b.depth - (Math.max(groundArea, upstairsArea) * 1.25 + STAIRWELL)) < 2, `${b.width} x ${b.depth}`);
  assert.ok(Math.abs(b.depth / b.width - lot.depth / lot.width) < 0.05);
  assert.ok(b.width <= lot.width && b.depth <= lot.depth);
});

test("a program that needs the whole lot uses the whole lot", () => {
  const lot = { width: 9, depth: 8 };
  assert.deepEqual(buildingShell(TEMPLATES.office, lot), lot);
});

test("the building never gets too narrow for a hall and two rows of rooms", () => {
  const b = buildingShell({ spaceType: "studio", floors: 1, rooms: [{ id: "a", name: "A", kind: "workspace", area: 10, zone: "public", floor: 0 }] }, { width: 30, depth: 40 });
  assert.ok(b.width >= 8 && b.depth >= 8);
});
