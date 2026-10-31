import { test } from "node:test";
import assert from "node:assert/strict";
import { blockers, step } from "./explore.ts";
import { planOptions } from "../layout/place.ts";
import { buildingShell } from "../layout/footprint.ts";
import { DEFAULT_SHELLS, TEMPLATES } from "../layout/templates.ts";

const wall = [{ x0: 0, x1: 10, z0: 4.95, z1: 5.05 }];

test("a step can't pass through a wall, however big", () => {
  const [, z] = step(5, 4, 0, 3, wall);
  assert.ok(z < 4.95 - 0.2, `stopped at ${z}`);
});

test("walking into a wall at an angle slides along it", () => {
  const [x, z] = step(5, 4.6, 1, 1, wall);
  assert.ok(x > 5.9 && z < 4.95 - 0.2, `${x}, ${z}`);
});

test("open floor lets the whole step through", () => {
  const [x, z] = step(1, 1, 0.5, 0.25, wall);
  assert.ok(Math.abs(x - 1.5) < 1e-9 && Math.abs(z - 1.25) < 1e-9);
});

test("a door gap lets a person through from the hall into the room", () => {
  const house = planOptions(TEMPLATES.house, buildingShell(TEMPLATES.house, DEFAULT_SHELLS.house))[0];
  const f = house.floors[1];
  const door = f.openings.find((o) => o.id === "door-primary")!;
  const walls = blockers(house, 1);
  // Start 1 m on one side of the door, walk 2 m straight through it.
  const dir = door.axis === "x" ? [0, 1] : [1, 0];
  const sx = door.x - dir[0];
  const sz = door.y - dir[1];
  const [x, z] = step(sx, sz, dir[0] * 2, dir[1] * 2, walls);
  assert.ok(Math.hypot(x - (sx + dir[0] * 2), z - (sz + dir[1] * 2)) < 1e-6, "walked through the door");
  // The same walk 1.5 m to the side hits the wall.
  const side = door.axis === "x" ? [1.5, 0] : [0, 1.5];
  const [x2, z2] = step(sx + side[0], sz + side[1], dir[0] * 2, dir[1] * 2, walls);
  assert.ok(Math.hypot(x2 - (sx + side[0] + dir[0] * 2), z2 - (sz + side[1] + dir[1] * 2)) > 0.5, "blocked by the wall");
});
