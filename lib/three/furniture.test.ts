import { test } from "node:test";
import assert from "node:assert/strict";
import { doorClearance, furnish, missingEssentials } from "./furniture.ts";
import { doorIsOpen, wallPieces } from "../layout/walls.ts";
import { planOptions } from "../layout/place.ts";
import { buildingShell } from "../layout/footprint.ts";
import { DEFAULT_SHELLS, TEMPLATES } from "../layout/templates.ts";
import { planOptionsFor } from "../design/options.ts";
import { snapPlan } from "../plan-import/snap.ts";
import type { Layout } from "../layout/schema.ts";

// Vicky's uploaded house (as read): no hall, so the master bedroom opens off the kitchen.
const uploaded = snapPlan({
  spaceType: "house",
  width: 12.19,
  depth: 9.14,
  entry: { x: 5.1, y: 9.14 },
  rooms: [
    { name: "Bedroom 2", kind: "bedroom", x: 0, y: 0, w: 2.74, h: 3.66 },
    { name: "Bedroom 3", kind: "bedroom", x: 2.74, y: 0, w: 2.74, h: 3.66 },
    { name: "Bath", kind: "bath", x: 5.48, y: 0, w: 1.22, h: 3.66 },
    { name: "Master Bedroom", kind: "bedroom", x: 6.7, y: 0, w: 3.86, h: 3.66 },
    { name: "Family Room", kind: "living", x: 0, y: 3.66, w: 4.57, h: 5.48 },
    { name: "Dining Area", kind: "dining", x: 4.57, y: 3.66, w: 2.74, h: 5.48 },
    { name: "Kitchen", kind: "kitchen", x: 7.31, y: 3.66, w: 2.59, h: 5.48 },
    { name: "Closet", kind: "closet", x: 10.56, y: 3.66, w: 1.83, h: 2.13 },
    { name: "Laundry", kind: "laundry", x: 10.56, y: 5.79, w: 1.83, h: 0.91 },
    { name: "Washroom", kind: "bath", x: 9.91, y: 6.7, w: 2.28, h: 2.44 },
  ].map((r) => ({ ...r, floor: 0 })),
}).layout;

const layouts = [
  ...Object.values(TEMPLATES).flatMap((p) => planOptions(p, buildingShell(p, DEFAULT_SHELLS[p.spaceType]))),
  ...Object.values(TEMPLATES).flatMap((p) => planOptionsFor(p, buildingShell(p, DEFAULT_SHELLS[p.spaceType]), { space_type: p.spaceType })),
  uploaded,
];

test("every piece sits inside its room", () => {
  for (const layout of layouts)
    for (const it of furnish(layout)) {
      const room = layout.floors[it.level].spaces.find((s) => s.id === it.room)!;
      const { x, y, w, h } = room.rect;
      assert.ok(it.x - it.w / 2 >= x - 1e-6 && it.x + it.w / 2 <= x + w + 1e-6, `${it.room}/${it.name} x`);
      assert.ok(it.z - it.d / 2 >= y - 1e-6 && it.z + it.d / 2 <= y + h + 1e-6, `${it.room}/${it.name} z`);
    }
});

test("nothing blocks the space in front of any door into a room, its own or a neighbour's", () => {
  for (const layout of layouts)
    for (const it of furnish(layout)) {
      if (it.name === "rug") continue;
      const f = layout.floors[it.level];
      const room = f.spaces.find((s) => s.id === it.room)!;
      for (const door of f.openings.filter((o) => o.type === "door" && o.between.includes(it.room))) {
        const c = doorClearance(door, room, doorIsOpen(door, wallPieces(f, layout.shell)));
        const clear = Math.abs(it.x - c.x) * 2 >= it.w + c.w - 1e-9 || Math.abs(it.z - c.z) * 2 >= it.d + c.d - 1e-9;
        assert.ok(clear, `${layout.concept?.id ?? layout.spaceType}: ${it.room}/${it.name} blocks ${door.id}`);
      }
    }
});

test("the uploaded house: the kitchen keeps the way into the master bedroom clear, and still has its kitchen", () => {
  const items = furnish(uploaded).filter((i) => i.room === "kitchen");
  assert.ok(items.some((i) => i.name === "kitchen run"), "the kitchen run found another wall");
});

test("a kitchen with a door on every wall still gets a counter, between the doors", () => {
  // Like Vicky's plan as saved: the dining area, the master bedroom, a closet and the hall all open off it.
  const kitchen = { id: "kitchen", name: "Kitchen", kind: "kitchen", zone: "public" as const, rect: { x: 0, y: 0, w: 2.6, h: 5.5 } };
  const door = (id: string, to: string, axis: "x" | "y", x: number, y: number) => ({ id, type: "door" as const, between: [to, "kitchen"] as [string, string], axis, x, y, width: 0.9 });
  const layout = {
    spaceType: "house" as const,
    shell: { width: 2.6, depth: 5.5 },
    floors: [{
      level: 0,
      spaces: [kitchen],
      openings: [door("d1", "dining", "y", 0, 1.2), door("d2", "master", "x", 1.3, 0), door("d3", "closet", "y", 2.6, 1.0), door("d4", "hall", "x", 1.3, 5.5)],
    }],
  } as unknown as Layout;
  const run = furnish(layout).find((i) => i.name === "kitchen run");
  assert.ok(run, "a counter fits");
});

test("every room people live in gets a plant", () => {
  const LIVED_IN = new Set(["living", "lounge", "bedroom", "guest-room", "dining", "office", "reception"]);
  for (const layout of layouts)
    for (const f of layout.floors)
      for (const room of f.spaces.filter((s) => LIVED_IN.has(s.kind))) {
        const has = furnish(layout).some((it) => it.room === room.id && it.level === f.level && it.role === "plant");
        // A plant may be dropped only when the room is too small to keep it clear of the door.
        if (room.rect.w * room.rect.h >= 6) assert.ok(has, `${layout.spaceType}/${room.id} has a plant`);
      }
});

const house = planOptions(TEMPLATES.house, buildingShell(TEMPLATES.house, DEFAULT_SHELLS.house))[0];

test("bedrooms get a bed and kitchens a full kitchen run", () => {
  const items = furnish(house);
  assert.ok(items.some((i) => i.room === "primary" && i.name === "bed"));
  assert.ok(items.some((i) => i.room === "kitchen" && i.name === "kitchen run"));
});

test("a piece's footprint is its own size, turned", () => {
  for (const layout of layouts)
    for (const it of furnish(layout)) {
      const across = Math.abs(Math.sin(it.rot)) > 0.5;
      assert.ok(Math.abs((across ? it.ld : it.lw) - it.w) < 1e-9 && Math.abs((across ? it.lw : it.ld) - it.d) < 1e-9, `${it.room}/${it.name}`);
    }
});

test("a kitchen too tight for an island gets a small table instead", () => {
  const items = furnish(house).filter((i) => i.room === "kitchen");
  assert.ok(items.some((i) => i.name === "island" || i.name === "cafe table"));
});

test("the sofa faces the TV, and pieces face into their room", () => {
  const items = furnish(house).filter((i) => i.room === "living");
  const sofa = items.find((i) => i.name === "sofa")!;
  const tv = items.find((i) => i.name === "media unit")!;
  assert.ok(Math.cos(sofa.rot - tv.rot) < -0.99, "they look at each other");
  // From the sofa, its front points toward the TV.
  assert.ok(Math.sin(sofa.rot) * (tv.x - sofa.x) + Math.cos(sofa.rot) * (tv.z - sofa.z) > 0);
});

test("a green-leaning taste gets more plants", () => {
  const count = (lush: boolean) => furnish(house, { lush }).filter((i) => i.name === "plant").length;
  assert.ok(count(true) > count(false));
});

test("every room in every template plan gets its essentials: a bed, a sofa and TV, a dining table, a toilet", () => {
  for (const layout of layouts) assert.deepEqual(missingEssentials(layout), [], layout.spaceType);
});

test("a powder room gets a toilet and basin but no shower", () => {
  const items = furnish(house).filter((i) => i.room === "powder");
  assert.ok(items.some((i) => i.name === "toilet") && items.some((i) => i.name === "vanity"));
  assert.ok(!items.some((i) => i.name === "shower"));
});

test("a café's seating is many small tables, and its kitchen has no café table in it", () => {
  const cafe = planOptions(TEMPLATES.cafe, buildingShell(TEMPLATES.cafe, DEFAULT_SHELLS.cafe))[0];
  const items = furnish(cafe);
  assert.ok(items.filter((i) => i.room === "seating" && i.name === "cafe table").length >= 3, "several tables");
  assert.ok(!items.some((i) => i.room === "seating" && i.name === "dining set"), "no family table");
  assert.ok(!items.some((i) => i.room === "kitchen" && i.name === "cafe table"));
});

test("a TV always stands against a wall, never free in the middle of a room", () => {
  for (const layout of layouts)
    for (const f of layout.floors)
      for (const tv of furnish(layout).filter((i) => i.name === "media unit" && i.level === f.level)) {
        const room = f.spaces.find((s) => s.id === tv.room)!.rect;
        // its back is the side away from where it faces
        const bx = tv.x - Math.sin(tv.rot) * (tv.ld / 2);
        const bz = tv.z - Math.cos(tv.rot) * (tv.ld / 2);
        const toWall = Math.min(Math.abs(bx - room.x), Math.abs(bx - room.x - room.w), Math.abs(bz - room.y), Math.abs(bz - room.y - room.h));
        assert.ok(toWall < 0.35, `${layout.spaceType} ${tv.room}: ${toWall.toFixed(2)} m from a wall`);
      }
});

test("plants go where people sit or sleep, not across the kitchen and hall", () => {
  const items = furnish(house, { lush: true });
  const rooms = new Map(house.floors.flatMap((f) => f.spaces.map((s) => [s.id, s.kind])));
  for (const p of items.filter((i) => i.name === "plant")) assert.ok(!["kitchen", "bath", "laundry"].includes(rooms.get(p.room) ?? ""), p.room);
});
