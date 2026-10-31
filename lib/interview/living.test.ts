import { test } from "node:test";
import assert from "node:assert/strict";
import { livingMissing, livingOf, mergeLiving } from "./living.ts";

test("saved answers are read back, and junk reads as nothing", () => {
  assert.deepEqual(livingOf({ living: { kitchen: "open", bedrooms: "apart" } }), { kitchen: "open", bedrooms: "apart" });
  assert.deepEqual(livingOf({ living: { kitchen: "sideways" } }), {});
  assert.deepEqual(livingOf({}), {});
  assert.deepEqual(livingOf(null), {});
});

test("later answers win, quotes merge by key and are trimmed", () => {
  const a = mergeLiving({ kitchen: "closed", said: { kitchen: "I hate cooking smells" } }, { kitchen: "semi", entertaining: "often", said: { entertaining: "  friends over every Friday  " } });
  assert.equal(a.kitchen, "semi");
  assert.equal(a.entertaining, "often");
  assert.deepEqual(a.said, { kitchen: "I hate cooking smells", entertaining: "friends over every Friday" });
  assert.equal(mergeLiving({}, { said: { kitchen: "x".repeat(500) } }).said!.kitchen.length, 140);
  assert.equal("said" in mergeLiving({}, { kitchen: "open" }), false);
});

test("homes need the kitchen and bedroom answers; other spaces don't", () => {
  assert.match(livingMissing("house", {})!, /kitchen.*bedrooms/);
  assert.match(livingMissing("apartment", { kitchen: "open" })!, /bedrooms/);
  assert.equal(livingMissing("house", { kitchen: "open", bedrooms: "together" }), null);
  assert.equal(livingMissing("cafe", {}), null);
  assert.equal(livingMissing(null, {}), null);
});
