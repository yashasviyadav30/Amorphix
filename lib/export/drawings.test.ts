import { test } from "node:test";
import assert from "node:assert/strict";
import { elevation, sayLength, schedule, wallTop } from "./drawings.ts";
import type { Exterior } from "../three/exterior.ts";
import type { Layout } from "../layout/schema.ts";
import { placeConcept } from "../layout/concepts.ts";
import { TEMPLATES, DEFAULT_SHELLS } from "../layout/templates.ts";
import { buildingShell } from "../layout/footprint.ts";

// A small made-up house: one room with a front door and a window on each side, and a second floor.
const room = (id: string, name: string, x: number, y: number, w: number, h: number) => ({ id, name, kind: "living", zone: "public" as const, rect: { x, y, w, h } });
const layout: Layout = {
  spaceType: "house",
  shell: { width: 10, depth: 8 },
  floors: [
    {
      level: 0,
      spaces: [room("living", "Living room", 0, 0, 10, 8)],
      openings: [
        { id: "front-door", type: "door", between: ["living", "outside"], x: 2, y: 0, axis: "x", width: 1 },
        { id: "front-win", type: "window", between: ["living", "outside"], x: 7, y: 0, axis: "x", width: 2 },
        { id: "back-win", type: "window", between: ["living", "outside"], x: 3, y: 8, axis: "x", width: 1.5 },
        { id: "left-win", type: "window", between: ["living", "outside"], x: 0, y: 2, axis: "y", width: 1 },
        { id: "right-win", type: "window", between: ["living", "outside"], x: 10, y: 6, axis: "y", width: 1 },
      ],
    },
    { level: 1, spaces: [room("bed", "Bedroom", 0, 0, 10, 8)], openings: [{ id: "up-win", type: "window", between: ["bed", "outside"], x: 5, y: 0, axis: "x", width: 1.2 }] },
  ],
};

test("doors and windows are tagged in reading order with their sizes and the rooms they join", () => {
  const s = schedule(layout);
  assert.deepEqual(s.doors.map((d) => [d.tag, d.between.join(" / "), d.width, d.height]), [["D01", "Living room / Outside", 1, 2.1]]);
  assert.deepEqual(s.windows.map((w) => w.tag), ["W01", "W02", "W03", "W04", "W05"]);
  assert.deepEqual([s.windows[0].sill, +s.windows[0].height.toFixed(2)], [0.9, 1.2]);
  assert.equal(s.windows.at(-1)!.level, 1); // the upstairs window comes last
});

test("each elevation shows the openings on that side, as seen from outside", () => {
  const front = elevation(layout, "front");
  assert.equal(front.length, 10);
  assert.deepEqual(front.openings.map((o) => [o.tag, o.t0, o.y0]), [["D01", 1.5, 0], ["W01", 6, 0.9], ["W05", 4.4, 4]]);
  // From behind, the back window at x = 3 is 7 m from the viewer's left.
  assert.deepEqual(elevation(layout, "back").openings.map((o) => [o.tag, o.t0]), [["W04", 6.25]]);
  // From the left, looking at the x = 0 wall, the back of the house is on the viewer's left.
  assert.deepEqual(elevation(layout, "left").openings.map((o) => [o.t0, o.t1]), [[5.5, 6.5]]);
  assert.deepEqual(elevation(layout, "right").openings.map((o) => [o.t0, o.t1]), [[5.5, 6.5]]);
  assert.equal(wallTop(layout), 3.1 + 2.8);
});

test("every generated house has a front with a door, and every tag appears once", () => {
  const house = placeConcept(TEMPLATES.house, buildingShell(TEMPLATES.house, DEFAULT_SHELLS.house), "hall-street")!;
  const s = schedule(house);
  const tags = [...s.doors, ...s.windows].map((t) => t.tag);
  assert.equal(new Set(tags).size, tags.length);
  const sides = (["front", "back", "left", "right"] as const).flatMap((side) => elevation(house, side).openings.map((o) => o.tag));
  assert.equal(new Set(sides).size, sides.length); // no opening drawn on two sides
  assert.ok(elevation(house, "front").openings.length > 0);
});

test("lengths read in metres or feet and inches", () => {
  assert.equal(sayLength(12.4, "metric"), "12.40 m");
  assert.equal(sayLength(12.4, "imperial"), `40' 8"`);
});

test("a pitched roof shows on the elevations: the slope on the long sides, the gable triangle on the ends", () => {
  const gable: Exterior = { roof: "gable", pitch: 35, overhang: 0.5, cladding: "timber", garden: false, because: ["x"] };
  const top = wallTop(layout);
  const front = elevation(layout, "front", undefined, gable);
  const side = elevation(layout, "left", undefined, gable);
  const ridge = top + 4 * Math.tan((35 * Math.PI) / 180); // half the 8 m span
  assert.ok(Math.abs(front.high - ridge) < 1e-9);
  assert.ok(Math.abs(side.high - (ridge + 0.3)) < 1e-9); // the end view also shows the roof's thickness
  assert.equal(front.infill, null);
  assert.equal(side.infill!.length, 3);
  assert.equal(elevation(layout, "front").infill, null); // flat by default, as before
});
