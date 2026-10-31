import { test } from "node:test";
import assert from "node:assert/strict";
import { chapterStarts, pathOf, stopAt, switchTo, TOUR } from "./tour.ts";

const ids = { maya: "11111111-1111-4111-8111-111111111111", sam: "22222222-2222-4222-8222-222222222222" };

test("a stop's path gets the seeded project id", () => {
  assert.equal(pathOf(TOUR[1], ids), `/project/${ids.maya}?step=brief`);
  assert.equal(pathOf(TOUR[0], ids), "/start?demo=1");
});

test("step numbers stay on the tour", () => {
  assert.equal(stopAt(0), 1);
  assert.equal(stopAt(Number("x")), 1);
  assert.equal(stopAt(99), TOUR.length);
});

test("switching role keeps the project only when that person is on it", () => {
  const maya = `/project/${ids.maya}?tab=site`;
  assert.equal(switchTo("mike", maya, ids), maya);
  assert.equal(switchTo("sam", maya, ids), "/home");
  assert.equal(switchTo("lena", "/home", ids), "/home");
});

test("every chapter has stops, in order, and the café's read comes before its 3D", () => {
  const starts = chapterStarts();
  assert.deepEqual([...starts].sort((a, b) => a - b), starts);
  assert.ok(starts.every((s) => s > 0));
  const read = TOUR.findIndex((s) => s.path.includes("#neighbourhood"));
  const cafe3d = TOUR.findIndex((s) => s.as === "sam" && s.path.includes("walkthrough"));
  assert.ok(read < cafe3d);
});
