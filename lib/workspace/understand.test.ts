import { test } from "node:test";
import assert from "node:assert/strict";
import { roomIn, suggestions, understand } from "./understand.ts";
import { applyChange } from "./edit.ts";
import { placeConcept } from "../layout/concepts.ts";
import { TEMPLATES, DEFAULT_SHELLS } from "../layout/templates.ts";
import { buildingShell } from "../layout/footprint.ts";
import type { Layout } from "../layout/schema.ts";

const program = TEMPLATES.house;
const house: Layout = { ...placeConcept(program, buildingShell(program, DEFAULT_SHELLS.house), "hall-street")!, concept: { id: "hall-street", name: "Hall", why: [] } };
const idOf = (kind: string) => house.floors.flatMap((f) => f.spaces).find((s) => s.kind === kind)!.id;

test("resizes, in three languages", () => {
  assert.deepEqual(understand("Make the kitchen bigger", house), { op: "resize", room: idOf("kitchen"), by: 1.25 });
  assert.deepEqual(understand("kitchen thoda bada karo", house), { op: "resize", room: idOf("kitchen"), by: 1.25 });
  assert.deepEqual(understand("किचन बड़ा करो", house), { op: "resize", room: idOf("kitchen"), by: 1.25 });
  assert.deepEqual(understand("make the kitchen much bigger", house), { op: "resize", room: idOf("kitchen"), by: 1.5625 });
  assert.equal((understand("living room chhota karo", house) as { by: number }).by, 0.8);
});

test("rooms by name win over rooms by kind", () => {
  assert.equal(roomIn("make bedroom 2 bigger", house)?.name, "Bedroom 2");
  assert.equal(roomIn("the primary bedroom", house)?.name, "Primary bedroom");
  assert.equal(roomIn("make the bedroom smaller", house)?.kind, "bedroom");
  assert.equal(roomIn("toilet", house)?.kind, "bath");
});

test("adds, removes, renames and the kitchen", () => {
  assert.deepEqual(understand("add a study please", house), { op: "add", kind: "office", name: "Study" });
  assert.deepEqual(understand("pooja room chahiye", house), { op: "add", kind: "prayer", name: "Prayer room" });
  assert.deepEqual(understand("Remove the laundry", house), { op: "remove", room: idOf("laundry") });
  assert.deepEqual(understand("laundry hatao", house), { op: "remove", room: idOf("laundry") });
  assert.deepEqual(understand("rename bedroom 2 to Kids room.", house), { op: "rename", room: house.floors.flatMap((f) => f.spaces).find((s) => s.name === "Bedroom 2")!.id, name: "Kids room" });
  assert.deepEqual(understand("open up the kitchen", house), { op: "kitchen", open: true });
  assert.deepEqual(understand("I want a separate kitchen", house), { op: "kitchen", open: false });
});

test("everyday phrasing, without the model", () => {
  assert.deepEqual(understand("I want somewhere to do yoga", house), { op: "add", kind: "gym", name: "Gym" });
  assert.equal((understand("the kids need more space", house) as { op: string })?.op, "resize");
  assert.equal(understand("give the living room more room", house)?.op, "resize");
  assert.equal(understand("living room mein aur jagah chahiye", house)?.op, "resize");
});

test("things it can't read come back empty, for the model to try", () => {
  assert.equal(understand("", house), null);
  assert.equal(understand("make it feel more like Kyoto", house), null);
  assert.equal(understand("bigger", house), null);
});

test("every suggestion is something the workspace can do", () => {
  for (const s of suggestions(house)) {
    const change = understand(s, house);
    assert.ok(change, s);
    const out = applyChange(house, change!);
    assert.ok("layout" in out || /can't get|isn't room/.test(out.error), `${s}: ${"error" in out ? out.error : ""}`);
  }
});
