import { test } from "node:test";
import assert from "node:assert/strict";
import { exteriorOf, PLAIN, rise, roofOutline, roofShape, sayExterior, type Exterior } from "./exterior.ts";
import type { Layout } from "../layout/schema.ts";

const house = { spaceType: "house", shell: { width: 12, depth: 8 }, floors: [{ level: 0, spaces: [], openings: [] }] } as Layout;
const look = (style: "scandi" | "classic" | "midcentury" | "modern" | "boho" | "industrial", over: Partial<{ finish: "paint" | "brick"; lush: boolean; because: string[] }> = {}) => ({
  style,
  finish: "paint" as const,
  lush: false,
  because: ["Ace Hotel"],
  ...over,
});

test("the exterior follows the taste: roof, cladding and garden", () => {
  assert.deepEqual(exteriorOf(house, look("scandi", { lush: true }), true), { roof: "gable", pitch: 35, overhang: 0.5, cladding: "timber", garden: true, because: ["Ace Hotel"] });
  assert.equal(exteriorOf(house, look("classic"), true).roof, "hip");
  assert.equal(exteriorOf(house, look("classic"), true).cladding, "render");
  assert.equal(exteriorOf(house, look("midcentury"), true).roof, "shed");
  assert.equal(exteriorOf(house, look("modern"), true).roof, "flat");
  assert.equal(exteriorOf(house, look("boho", { finish: "brick" }), true).cladding, "brick"); // brick in the brief wins
});

test("a fit-out keeps its roof; flats and businesses stay plain; no named source means no taste claim", () => {
  assert.equal(exteriorOf(house, look("scandi"), false).roof, "flat");
  assert.equal(exteriorOf(house, look("scandi"), false).cladding, "timber");
  assert.deepEqual(exteriorOf({ ...house, spaceType: "cafe" }, look("scandi"), true), PLAIN);
  assert.deepEqual(exteriorOf(house, look("scandi", { because: [] }), true), PLAIN);
});

test("the source line reads plainly", () => {
  assert.equal(sayExterior(exteriorOf(house, look("scandi", { lush: true }), true)), "A pitched gable roof, timber walls and a planted garden");
  assert.equal(sayExterior(PLAIN), "A flat roof and render walls");
});

const gable: Exterior = { roof: "gable", pitch: 45, overhang: 0, cladding: "timber", garden: false, because: ["x"] };

test("a gable rises half the span, runs along the longer side, and fills its end walls", () => {
  assert.ok(Math.abs(rise(gable, 12, 8) - 4) < 1e-9); // 45° over half of 8 m
  const s = roofShape(gable, 12, 8, 3);
  assert.equal(s.roof.length, 4);
  assert.equal(s.infill.length, 2);
  const ys = s.roof.flat().map((p) => p[1]);
  assert.ok(Math.abs(Math.max(...ys) - 7) < 1e-9);
  // The ridge runs along x (the 12 m side): its points sit at z = 4.
  assert.ok(s.roof.flat().filter((p) => Math.abs(p[1] - 7) < 1e-9).every((p) => Math.abs(p[2] - 4) < 1e-9));
  // On a deep plot it turns: the ridge runs along z.
  const deep = roofShape(gable, 8, 12, 3);
  assert.ok(deep.roof.flat().filter((p) => Math.abs(p[1] - 7) < 1e-9).every((p) => Math.abs(p[0] - 4) < 1e-9));
});

test("elevations: the eave side shows the slope, the end shows the gable triangle", () => {
  const front = roofOutline(gable, 12, 8, 3, "front");
  assert.equal(front.infill, null);
  assert.ok(Math.abs(Math.max(...front.roof.map((p) => p[1])) - 7) < 1e-9);
  const end = roofOutline(gable, 12, 8, 3, "left");
  assert.deepEqual(end.infill!.map((p) => p.map((v) => +v.toFixed(6))), [[0, 3], [8, 3], [4, 7]]);
  assert.ok(roofOutline({ ...gable, roof: "hip" }, 12, 8, 3, "right").roof.length === 3); // the hip's end face
});

test("a single slope rises to the back, so it is high on the left of the left side and the right of the right side", () => {
  const shed: Exterior = { ...gable, roof: "shed", pitch: 10 };
  const left = roofOutline(shed, 12, 8, 3, "left").infill!;
  const right = roofOutline(shed, 12, 8, 3, "right").infill!;
  assert.equal(left[2][0], 0);
  assert.equal(right[2][0], 8);
  assert.ok(roofOutline(shed, 12, 8, 3, "back").infill!.length === 4); // the tall back wall
  assert.equal(roofShape(shed, 12, 8, 3).infill.length, 4);
});

test("a flat roof is the slab it always was", () => {
  assert.deepEqual(roofShape(PLAIN, 12, 8, 3), { roof: [], infill: [] });
  assert.deepEqual(roofOutline(PLAIN, 12, 8, 3, "front").roof, [[-0.3, 3], [12.3, 3], [12.3, 3.3], [-0.3, 3.3]]);
});
