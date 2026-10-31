import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSlabs, buildWalls, DOOR_H, EYE, onTour, SILL, stairBoxes, stairWalk, STOREY, walkPath, walkPlan, WALL_H } from "./geometry.ts";
import { place } from "../layout/place.ts";
import { DEFAULT_SHELLS, TEMPLATES } from "../layout/templates.ts";
import type { Layout } from "../layout/schema.ts";

// Two rooms side by side, a door between them and a window in the left one.
const tiny: Layout = {
  spaceType: "studio",
  shell: { width: 8, depth: 4 },
  floors: [
    {
      level: 0,
      spaces: [
        { id: "a", name: "A", kind: "living", zone: "public", rect: { x: 0, y: 0, w: 4, h: 4 } },
        { id: "b", name: "B", kind: "bedroom", zone: "private", rect: { x: 4, y: 0, w: 4, h: 4 } },
      ],
      openings: [
        { id: "door-ab", type: "door", between: ["a", "b"], x: 4, y: 2, axis: "y", width: 0.9 },
        { id: "win-a", type: "window", between: ["a", "outside"], x: 2, y: 0, axis: "x", width: 1.2 },
      ],
    },
  ],
};

test("a wall shared by two rooms is built once", () => {
  const { walls } = buildWalls(tiny);
  const shared = walls.filter((w) => w.axis === "z" && w.at === 4);
  // Split by the door: below it, above it, and the lintel over the opening.
  assert.equal(shared.length, 3);
  assert.ok(shared.every((w) => !w.exterior && w.thick === 0.1));
});

test("a door leaves a full-height gap up to the lintel", () => {
  const { walls } = buildWalls(tiny);
  const lintel = walls.find((w) => w.axis === "z" && w.at === 4 && w.y0 === DOOR_H)!;
  assert.ok(Math.abs(lintel.from - 1.55) < 1e-9 && Math.abs(lintel.to - 2.45) < 1e-9);
  assert.equal(lintel.y1, WALL_H);
  assert.ok(!walls.some((w) => w.axis === "z" && w.at === 4 && w.y0 === 0 && w.from < 2.4 && w.to > 1.6), "nothing fills the doorway");
});

test("a window has a sill, glass and a lintel in an exterior wall", () => {
  const { walls, glass } = buildWalls(tiny);
  const front = walls.filter((w) => w.axis === "x" && w.at === 0);
  assert.ok(front.every((w) => w.exterior && w.thick === 0.2));
  assert.ok(front.some((w) => w.y0 === 0 && w.y1 === SILL && Math.abs(w.from - 1.4) < 1e-9));
  assert.deepEqual(glass.map((g) => [g.from, g.to, g.y0, g.y1]), [[1.4, 2.6, SILL, DOOR_H]]);
});

test("every room gets a floor slab at its storey", () => {
  const layout = place(TEMPLATES.house, DEFAULT_SHELLS.house);
  const slabs = buildSlabs(layout);
  assert.equal(slabs.length, layout.floors.reduce((t, f) => t + f.spaces.length, 0));
  assert.ok(slabs.filter((s) => s.level === 1).every((s) => s.y === STOREY));
});

test("the walk starts outside, enters by the front door and visits every room", () => {
  const layout = place(TEMPLATES.house, DEFAULT_SHELLS.house);
  const path = walkPath(layout);
  const entry = layout.floors[0].openings.find((o) => o.id === "door-entry")!;
  assert.ok(path[0][0] < 0 || path[0][2] < 0 || path[0][0] > layout.shell.width || path[0][2] > layout.shell.depth, "starts outside");
  assert.deepEqual([path[1][0], path[1][2]], [entry.x, entry.y]);
  for (const f of layout.floors)
    for (const s of f.spaces.filter(onTour)) {
      const { x, y, w, h } = s.rect;
      const inRoom = (p: number[]) => p[0] > x + 0.2 && p[0] < x + w - 0.2 && p[2] > y + 0.2 && p[2] < y + h - 0.2 && Math.abs(p[1] - (f.level * STOREY + EYE)) < 1e-9;
      assert.ok(path.some(inRoom), `steps into ${s.id}`);
    }
  // At eye height on a floor, or partway up only while on the stairs.
  const stairs = layout.floors[0].spaces.find((s) => s.kind === "stairs")!.rect;
  const onStairs = (p: number[]) => p[0] >= stairs.x - 1e-6 && p[0] <= stairs.x + stairs.w + 1e-6 && p[2] >= stairs.y - 1e-6 && p[2] <= stairs.y + stairs.h + 1e-6;
  assert.ok(path.every((p) => p[1] === EYE || p[1] === STOREY + EYE || onStairs(p)), "eye height, or climbing the stairs");
});

test("the walk never passes through a wall", () => {
  // Consecutive points either stay in one space or cross at a door.
  const layout = place(TEMPLATES.apartment, DEFAULT_SHELLS.apartment);
  const path = walkPath(layout);
  const f = layout.floors[0];
  const where = (x: number, z: number) => f.spaces.find((s) => x >= s.rect.x - 1e-6 && x <= s.rect.x + s.rect.w + 1e-6 && z >= s.rect.y - 1e-6 && z <= s.rect.y + s.rect.h + 1e-6);
  const doors = f.openings.filter((o) => o.type === "door").map((o) => [o.x, o.y]);
  for (let i = 1; i < path.length; i++) {
    const [ax, , az] = path[i - 1];
    const [bx, , bz] = path[i];
    const onDoor = (x: number, z: number) => doors.some(([dx, dz]) => Math.abs(dx - x) < 1e-9 && Math.abs(dz - z) < 1e-9);
    if (onDoor(ax, az) || onDoor(bx, bz) || !where(ax, az) || !where(bx, bz)) continue;
    assert.equal(where(ax, az)?.id, where(bx, bz)?.id, `step ${i} crosses from ${where(ax, az)?.id} to ${where(bx, bz)?.id}`);
  }
});

test("inside each room the camera looks across the room, not back at the hall", () => {
  const layout = place(TEMPLATES.house, DEFAULT_SHELLS.house);
  const { path, gaze } = walkPlan(layout);
  assert.equal(path.length, gaze.length);
  for (const f of layout.floors)
    for (const s of f.spaces.filter(onTour)) {
      const { x, y, w, h } = s.rect;
      const i = path.findIndex((p) => p[0] > x && p[0] < x + w && p[2] > y && p[2] < y + h && Math.abs(p[1] - (f.level * STOREY + EYE)) < 1e-9);
      assert.ok(i >= 0, `steps into ${s.id}`);
      const g = gaze[i];
      assert.ok(g[0] >= x - 1e-6 && g[0] <= x + w + 1e-6 && g[2] >= y - 1e-6 && g[2] <= y + h + 1e-6, `looks into ${s.id}`);
      assert.ok(g[1] < path[i][1], "looks slightly down, toward the furniture");
    }
});

test("the tour skips small utility rooms and pauses at every room it shows", () => {
  const layout = place(TEMPLATES.house, DEFAULT_SHELLS.house);
  const { path, stops } = walkPlan(layout);
  const powder = layout.floors[0].spaces.find((s) => s.id === "powder")!;
  const { x, y, w, h } = powder.rect;
  assert.ok(!path.some((p) => p[0] > x + 0.2 && p[0] < x + w - 0.2 && p[2] > y + 0.2 && p[2] < y + h - 0.2 && p[1] === EYE), "no detour into the powder room");
  const toured = layout.floors.flatMap((f) => f.spaces.filter(onTour));
  assert.equal(stops.length, toured.length);
});

test("the U stair starts at the door, climbs a full storey and arrives back by the door above", () => {
  const rect = { x: 7.2, y: 0, w: 3.6, h: 3.0 };
  const door = { id: "door-stairs", type: "door" as const, between: ["stairs", "hall"] as [string, string], x: 7.2 + 0.55, y: 3.0, axis: "x" as const, width: 0.9 };
  const boxes = stairBoxes(rect, door);
  for (const b of boxes) {
    assert.ok(b.x - b.w / 2 >= rect.x - 1e-9 && b.x + b.w / 2 <= rect.x + rect.w + 1e-9, "inside on x");
    assert.ok(b.z - b.d / 2 >= rect.y - 1e-9 && b.z + b.d / 2 <= rect.y + rect.h + 1e-9, "inside on z");
  }
  const top = Math.max(...boxes.map((b) => b.y + b.h));
  assert.ok(Math.abs(top - STOREY) < 1e-9, `top ${top}`);
  // The first step is on the hall side, just past the bottom landing by the door, and low.
  const first = boxes[0];
  assert.ok(first.z > rect.y + rect.h / 2, "first flight beside the hall");
  assert.ok(Math.abs(first.x - first.w / 2 - (rect.x + 0.9)) < 1e-9, "first step starts after the bottom landing");
  // Steps only ever go up along each flight.
  for (let i = 1; i < 8; i++) assert.ok(boxes[i].h > boxes[i - 1].h);
  // The walk up starts and ends by the stairwell door, a storey apart.
  const walk = stairWalk(rect, door, 0);
  assert.ok(Math.abs(walk[0][0] - door.x) < 0.05 && Math.abs(walk.at(-1)![0] - door.x) < 0.05);
  assert.ok(Math.abs(walk.at(-1)![1] - walk[0][1] - STOREY) < 1e-9);
  for (let i = 1; i < walk.length; i++) assert.ok(walk[i][1] >= walk[i - 1][1] - 1e-9, "never steps down");
});

test("the walk visits every room once, open plan or not", async () => {
  const { CONCEPT_IDS, placeConcept } = await import("../layout/concepts.ts");
  for (const c of CONCEPT_IDS) {
    const l = placeConcept(TEMPLATES.house, { width: 13, depth: 8.4 }, c)!;
    const { stops } = walkPlan(l);
    const tour = l.floors.flatMap((f) => f.spaces.filter(onTour));
    assert.equal(stops.length, tour.length, `${c}: ${stops.length} stops for ${tour.length} rooms`);
    const keys = stops.map((p) => p.map((v) => v.toFixed(2)).join(","));
    assert.equal(new Set(keys).size, keys.length, `${c}: a stop repeats`);
  }
});

test("the walk never passes through a wall, in any layout concept", async () => {
  const { CONCEPT_IDS, placeConcept } = await import("../layout/concepts.ts");
  const { wallCrossings } = await import("./explore.ts");
  const { buildingShell } = await import("../layout/footprint.ts");
  for (const [type, program] of Object.entries(TEMPLATES))
    for (const c of CONCEPT_IDS) {
      const l = placeConcept(program, buildingShell(program, DEFAULT_SHELLS[program.spaceType]), c);
      if (!l) continue;
      assert.deepEqual(wallCrossings(l, walkPlan(l).path), [], `${type}/${c}`);
    }
});

test("in a deep stairwell the stair turns to run away from the hall, and still ends by the door", () => {
  // Stairwell 2.6 wide along the hall, 4.6 deep toward the facade; the hall is along its bottom edge (z = 4.6).
  const rect = { x: 8, y: 0, w: 2.6, h: 4.6 };
  const door = { id: "door-stairs", type: "door" as const, between: ["stairs", "hall"] as [string, string], x: 8.55, y: 4.6, axis: "x" as const, width: 0.9 };
  const boxes = stairBoxes(rect, door);
  for (const b of boxes) assert.ok(b.x - b.w / 2 >= rect.x - 1e-9 && b.x + b.w / 2 <= rect.x + rect.w + 1e-9 && b.z - b.d / 2 >= rect.y - 1e-9 && b.z + b.d / 2 <= rect.y + rect.h + 1e-9);
  // The first flight climbs away from the hall: its steps get further from the hall wall as they rise.
  assert.ok(boxes[0].z > boxes[7].z, "first flight climbs toward the facade");
  assert.ok(boxes[0].x < rect.x + rect.w / 2, "first flight on the door's side");
  const walk = stairWalk(rect, door, 0);
  for (const p of [walk[0], walk.at(-1)!]) assert.ok(Math.hypot(p[0] - door.x, p[2] - door.y) < 0.7, "starts and ends by the door");
});
