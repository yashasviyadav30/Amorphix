import { test } from "node:test";
import assert from "node:assert/strict";
import { Layout } from "./schema.ts";
import { planOptions, place } from "./place.ts";
import { DEFAULT_SHELLS, TEMPLATES } from "./templates.ts";
import { buildingShell } from "./footprint.ts";
import { validate } from "./validate.ts";

for (const [type, program] of Object.entries(TEMPLATES)) {
  test(`${type}: all three plan options are valid`, () => {
    const options = planOptions(program, DEFAULT_SHELLS[program.spaceType]);
    assert.equal(options.length, 3);
    for (const layout of options) {
      Layout.parse(layout);
      assert.deepEqual(validate(layout), []);
      const ids = layout.floors.flatMap((f) => f.spaces.map((s) => s.id));
      for (const r of program.rooms) assert.ok(ids.includes(r.id), `${r.id} is placed`);
    }
  });
}

test("rooms fill the shell with no gaps", () => {
  const layout = place(TEMPLATES.apartment, DEFAULT_SHELLS.apartment);
  const area = layout.floors[0].spaces.reduce((t, s) => t + s.rect.w * s.rect.h, 0);
  assert.ok(Math.abs(area - 12 * 8) < 1e-6);
});

test("the validator catches overlaps, unreachable rooms and missing windows", () => {
  const layout = structuredClone(place(TEMPLATES.apartment, DEFAULT_SHELLS.apartment));
  const floor = layout.floors[0];
  const bed = floor.spaces.find((s) => s.id === "primary")!;
  bed.rect.x += 1; // now overlaps its neighbour
  floor.openings = floor.openings.filter((o) => o.id !== "door-bed-2" && o.id !== "win-living");
  const errors = validate(layout).join("\n");
  assert.match(errors, /overlaps/);
  assert.match(errors, /bed-2 can't be reached/);
  assert.match(errors, /living has no window/);
});

test("the validator catches a hole in the floor", () => {
  const layout = structuredClone(place(TEMPLATES.apartment, DEFAULT_SHELLS.apartment));
  const floor = layout.floors[0];
  floor.spaces = floor.spaces.filter((s) => s.id !== "bed-2");
  floor.openings = floor.openings.filter((o) => !o.between.includes("bed-2"));
  assert.ok(validate(layout).some((e) => /leaving a hole/.test(e)));
});

test("a shell too shallow for two rows of rooms is refused", () => {
  assert.throws(() => place(TEMPLATES.apartment, { width: 12, depth: 5 }), /too shallow/);
});

test("on a deep lot the hall runs front to back and rooms keep sensible proportions", () => {
  const lot = { width: 12.2, depth: 18.3 };
  const deep = buildingShell(TEMPLATES.house, lot);
  assert.ok(deep.depth > deep.width);
  for (const layout of planOptions(TEMPLATES.house, deep)) {
    assert.deepEqual(validate(layout), []);
    for (const f of layout.floors) {
      const hall = f.spaces.find((s) => s.kind === "corridor")!;
      assert.ok(hall.rect.h > hall.rect.w, "hall runs along the depth");
      for (const s of f.spaces.filter((s) => s.zone !== "circulation")) {
        const ratio = Math.max(s.rect.w, s.rect.h) / Math.min(s.rect.w, s.rect.h);
        // Rooms people live in stay roomy; utility rooms may be galley-shaped.
        const limit = s.zone === "service" ? 4.5 : 3.2;
        assert.ok(ratio <= limit, `${s.id} is ${ratio.toFixed(1)}:1, limit ${limit}`);
      }
    }
    const entry = layout.floors[0].openings.find((o) => o.id === "door-entry")!;
    assert.ok(entry.y === 0 || entry.y === deep.depth, "the entrance is on the street or garden side");
  }
});

test("rooms come out close to the size the program asked for", () => {
  const lot = { width: 12.2, depth: 18.3 };
  for (const layout of planOptions(TEMPLATES.house, buildingShell(TEMPLATES.house, lot)))
    for (const f of layout.floors)
      for (const s of f.spaces.filter((s) => s.zone !== "circulation")) {
        const asked = TEMPLATES.house.rooms.find((r) => r.id === s.id)!.area;
        const got = s.rect.w * s.rect.h;
        assert.ok(got < asked * 2, `${s.id}: asked ${asked} m², got ${got.toFixed(1)} m²`);
      }
});

test("the validator catches a window over a door", () => {
  const layout = structuredClone(place(TEMPLATES.apartment, DEFAULT_SHELLS.apartment));
  const floor = layout.floors[0];
  const door = floor.openings.find((o) => o.id === "door-entry")!;
  floor.openings.push({ id: "win-bad", type: "window", between: ["hall", "outside"], x: door.x, y: door.y, axis: door.axis, width: 1 });
  assert.ok(validate(layout).some((e) => /win-bad and door-entry overlap|door-entry and win-bad overlap/.test(e)));
});
