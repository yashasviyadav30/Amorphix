import { test } from "node:test";
import assert from "node:assert/strict";
import { snapPlan, type ReadPlan } from "./snap.ts";
import { CONCEPT_IDS, placeConcept } from "../layout/concepts.ts";
import { buildingShell } from "../layout/footprint.ts";
import { DEFAULT_SHELLS, TEMPLATES } from "../layout/templates.ts";
import type { Layout } from "../layout/schema.ts";

// What a model might read off a drawing of one of our own plans: every room but the halls, each edge off by
// up to 15 cm. Snapping it back must give a valid plan with the same rooms at nearly the same size.
function asRead(l: Layout, seed = 1): ReadPlan {
  let s = seed;
  const jitter = () => ((s = (s * 9301 + 49297) % 233280), (s / 233280 - 0.5) * 0.3);
  return {
    spaceType: l.spaceType,
    width: l.shell.width,
    depth: l.shell.depth,
    rooms: l.floors.flatMap((f) =>
      f.spaces
        .filter((sp) => sp.kind !== "corridor")
        .map((sp) => ({ name: sp.name, kind: sp.kind, floor: f.level, x: sp.rect.x + jitter(), y: sp.rect.y + jitter(), w: sp.rect.w + jitter(), h: sp.rect.h + jitter() })),
    ),
  };
}

for (const type of ["house", "apartment", "office", "cafe"] as const)
  test(`${type}: a noisy reading of our own plans snaps back to a valid plan with the same rooms`, () => {
    const program = TEMPLATES[type];
    for (const c of CONCEPT_IDS) {
      const original = placeConcept(program, buildingShell(program, DEFAULT_SHELLS[program.spaceType]), c);
      if (!original) continue;
      const { layout, problems } = snapPlan(asRead(original, c.length));
      assert.deepEqual(problems, [], `${type}/${c}`);
      for (const f of original.floors)
        for (const sp of f.spaces.filter((x) => x.zone !== "circulation")) {
          const got = layout.floors[f.level].spaces.find((x) => x.name === sp.name)!;
          assert.ok(got, `${sp.name} kept`);
          const ratio = (got.rect.w * got.rect.h) / (sp.rect.w * sp.rect.h);
          assert.ok(ratio > 0.85 && ratio < 1.15, `${sp.name} area ${ratio.toFixed(2)}x`);
        }
    }
  });

test("a gap the drawing left between rooms becomes a hall that every room opens onto", () => {
  const read: ReadPlan = {
    spaceType: "apartment", width: 10, depth: 8,
    rooms: [
      { name: "Living room", kind: "living", floor: 0, x: 0, y: 0, w: 6, h: 3.4 },
      { name: "Kitchen", kind: "kitchen", floor: 0, x: 6, y: 0, w: 4, h: 3.4 },
      { name: "Bedroom", kind: "bedroom", floor: 0, x: 0, y: 4.6, w: 5, h: 3.4 },
      { name: "Bath", kind: "bath", floor: 0, x: 5, y: 4.6, w: 2, h: 3.4 },
      { name: "Bedroom 2", kind: "bedroom", floor: 0, x: 7, y: 4.6, w: 3, h: 3.4 },
    ],
  };
  const { layout, problems } = snapPlan(read);
  assert.deepEqual(problems, []);
  const hall = layout.floors[0].spaces.find((s) => s.kind === "corridor")!;
  assert.deepEqual(hall.rect, { x: 0, y: 3.4, w: 10, h: 1.2 });
  for (const id of ["bedroom", "bath", "bedroom-2"]) {
    const door = layout.floors[0].openings.find((o) => o.type === "door" && o.between[0] === id)!;
    assert.equal(door.between[1], "hall", `${id} opens onto the hall`);
  }
  const entry = layout.floors[0].openings.find((o) => o.id === "door-entry")!;
  assert.ok(entry, "has a front door");
});

test("rooms that don't fit together are reported, not hidden", () => {
  const read: ReadPlan = {
    spaceType: "house", width: 10, depth: 8,
    rooms: [
      { name: "Living room", kind: "living", floor: 0, x: 0, y: 0, w: 6, h: 8 },
      { name: "Bedroom", kind: "bedroom", floor: 0, x: 4, y: 0, w: 6, h: 8 },
    ],
  };
  const { problems } = snapPlan(read);
  assert.ok(problems.some((p) => /overlaps/.test(p)));
});

test("odd readings never crash: unknown kinds, tiny scraps, rooms off the edge, duplicate names", () => {
  const read: ReadPlan = {
    spaceType: "house", width: 9, depth: 7,
    rooms: [
      { name: "Den", kind: "den", floor: 0, x: -1, y: -0.5, w: 5, h: 4 },
      { name: "Den", kind: "living", floor: 0, x: 4, y: 0, w: 6, h: 4 },
      { name: "Scrap", kind: "bath", floor: 0, x: 3, y: 5, w: 0.2, h: 0.2 },
    ],
  };
  const { layout } = snapPlan(read);
  const ids = layout.floors[0].spaces.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "unique ids");
  assert.ok(layout.floors[0].spaces.every((s) => s.rect.x >= 0 && s.rect.x + s.rect.w <= 9 + 1e-9));
  assert.ok(!ids.includes("scrap"));
});

test("a real reading that drifted 50 cm off the front wall still makes a usable plan", () => {
  // What Gemini returned for a drawn apartment on one run: everything shifted back half a metre, the hall too thin.
  const read: ReadPlan = {
    spaceType: "apartment", width: 11.1, depth: 8,
    rooms: [
      { name: "Living and Dining", kind: "living", floor: 0, x: 0, y: 0.5, w: 8, h: 3.7 },
      { name: "Kitchen", kind: "kitchen", floor: 0, x: 8, y: 0.5, w: 3.1, h: 3.7 },
      { name: "Entry Corridor", kind: "corridor", floor: 0, x: 0, y: 4.2, w: 11.1, h: 0.7 },
      { name: "Bedroom 1", kind: "bedroom", floor: 0, x: 0, y: 4.9, w: 5.2, h: 3.1 },
      { name: "Bedroom 2", kind: "bedroom", floor: 0, x: 5.2, y: 4.9, w: 4, h: 3.1 },
      { name: "Bath", kind: "bath", floor: 0, x: 9.2, y: 4.9, w: 1.9, h: 3.1 },
    ],
  };
  const { layout, problems } = snapPlan(read);
  assert.deepEqual(problems, []);
  const living = layout.floors[0].spaces.find((s) => s.id === "living-and-dining")!;
  assert.equal(living.rect.y, 0, "snapped to the front wall");
  const entry = layout.floors[0].openings.find((o) => o.id === "door-entry")!;
  assert.notEqual(entry.between[0], "hall", "the front door leads into a real space");
});

test("a thin strip beside a room joins that room instead of becoming a hall", () => {
  const read: ReadPlan = {
    spaceType: "apartment", width: 10, depth: 8,
    rooms: [
      { name: "Living room", kind: "living", floor: 0, x: 0, y: 0, w: 10, h: 3 },
      { name: "Hall", kind: "corridor", floor: 0, x: 0, y: 3.5, w: 10, h: 1.2 },
      { name: "Bedroom", kind: "bedroom", floor: 0, x: 0, y: 4.7, w: 10, h: 3.3 },
    ],
  };
  const { layout, problems } = snapPlan(read);
  assert.deepEqual(problems, []);
  assert.equal(layout.floors[0].spaces.filter((s) => s.kind === "corridor").length, 1, "no extra sliver hall");
});

test("a real open-plan house with no hall: bedrooms open off the living space, the front door goes where it was drawn", () => {
  // Vicky's upload: a 30 x 40 ft three-bedroom house, as Gemini read it (rooms at the top, entrance at the bottom).
  const rooms = [
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
  ].map((r) => ({ ...r, floor: 0 }));
  const { layout, problems } = snapPlan({ spaceType: "house", width: 12.19, depth: 9.14, rooms, entry: { x: 5.1, y: 9.14 } });
  assert.deepEqual(problems, []);
  const doors = layout.floors[0].openings.filter((o) => o.type === "door");
  const to = (id: string) => doors.find((o) => o.between[0] === id)?.between[1];
  assert.equal(doors.find((o) => o.id === "door-entry")!.between[0], "dining-area");
  assert.equal(to("bedroom-2"), "family-room");
  assert.equal(to("bedroom-3"), "family-room");
  for (const id of ["bedroom-2", "bedroom-3", "master-bedroom"]) assert.ok(!["bath", "washroom"].includes(to(id)!), `${id} doesn't open through a bath`);
});

test("rooms read as slightly overlapping meet halfway", () => {
  const read: ReadPlan = {
    spaceType: "apartment", width: 10, depth: 8,
    rooms: [
      { name: "Living room", kind: "living", floor: 0, x: 0, y: 0, w: 10, h: 3.4 },
      { name: "Hall", kind: "corridor", floor: 0, x: 0, y: 3.4, w: 10, h: 1.2 },
      { name: "Bedroom", kind: "bedroom", floor: 0, x: 0, y: 4.6, w: 5.6, h: 3.4 },
      { name: "Bath", kind: "bath", floor: 0, x: 5, y: 4.6, w: 5, h: 3.4 },
    ],
  };
  const { layout, problems } = snapPlan(read);
  assert.deepEqual(problems, []);
  const bed = layout.floors[0].spaces.find((s) => s.id === "bedroom")!.rect;
  const bath = layout.floors[0].spaces.find((s) => s.id === "bath")!.rect;
  assert.equal(bed.x + bed.w, bath.x);
  assert.equal(bath.x, 5.3);
});
