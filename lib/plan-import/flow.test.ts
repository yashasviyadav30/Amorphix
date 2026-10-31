import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEdits, importedOf, plainProblem, rescale } from "./edits.ts";
import { snapPlan, type ReadPlan } from "./snap.ts";

const read: ReadPlan = {
  spaceType: "apartment", width: 10, depth: 8,
  rooms: [
    { name: "Living room", kind: "living", floor: 0, x: 0, y: 0, w: 6, h: 3.4 },
    { name: "Kitchen", kind: "kitchen", floor: 0, x: 6, y: 0, w: 4, h: 3.4 },
    { name: "Room 3", kind: "living", floor: 0, x: 0, y: 4.6, w: 5, h: 3.4 },
    { name: "Bath", kind: "bath", floor: 0, x: 5, y: 4.6, w: 2, h: 3.4 },
    { name: "Bedroom 2", kind: "bedroom", floor: 0, x: 7, y: 4.6, w: 3, h: 3.4 },
  ],
};

test("renaming a room and changing its type moves it to the right zone", () => {
  const { layout } = snapPlan(read);
  const edited = applyEdits(layout, [{ id: "room-3", name: "Study", kind: "office" }, { id: "hall", name: "Nope", kind: "bedroom" }]);
  const study = edited.floors[0].spaces.find((s) => s.id === "room-3")!;
  assert.deepEqual([study.name, study.kind, study.zone], ["Study", "office", "private"]);
  const hall = edited.floors[0].spaces.find((s) => s.id === "hall")!;
  assert.equal(hall.kind, "corridor", "halls can't be retyped");
});

test("an unknown type is ignored rather than breaking the plan", () => {
  const { layout } = snapPlan(read);
  const edited = applyEdits(layout, [{ id: "kitchen", kind: "spaceship" }]);
  assert.equal(edited.floors[0].spaces.find((s) => s.id === "kitchen")!.kind, "kitchen");
});

test("a size given later scales the whole reading", () => {
  const r = rescale(read, 20, 16);
  assert.equal(r.width, 20);
  assert.deepEqual([r.rooms[1].x, r.rooms[1].w, r.rooms[2].y], [12, 8, 9.2]);
  assert.deepEqual(snapPlan(r).problems, []);
});

test("only a project started from an upload has an imported plan", () => {
  assert.equal(importedOf({}), null);
  assert.equal(importedOf(null), null);
  assert.ok(importedOf({ imported: { read, layout: snapPlan(read).layout, problems: [], advice: [], questions: [] } }));
});

test("problems read in the user's words", () => {
  const { layout } = snapPlan(read);
  assert.equal(plainProblem("floor 0: room-3 opens into the stairs", layout), "Ground floor: Room 3 opens into the stairs");
  assert.equal(plainProblem("floor 1: door-kitchen and win-bath overlap on the same wall", layout), "Upstairs: the door of Kitchen and the window of Bath overlap on the same wall");
});
