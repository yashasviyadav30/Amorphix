import { test } from "node:test";
import assert from "node:assert/strict";
import { costDelta, deltaText, isLocked } from "./change.ts";
import { statusAfter } from "./review.ts";
import { MARKETS } from "../budget/costs.ts";
import { templateFor } from "../design/program.ts";
import { planOptionsFor } from "../design/options.ts";
import { buildingShell } from "../layout/footprint.ts";
import { DEFAULT_SHELLS } from "../layout/templates.ts";
import { applyChange } from "../workspace/edit.ts";

const house = () => {
  const p = templateFor("house", 2);
  return planOptionsFor(p, buildingShell(p, DEFAULT_SHELLS.house), { space_type: "house" })[0];
};
const project = { interview: {}, site: { location: "Los Angeles, CA" } };

test("an approved design, or one being built, takes changes as requests; after move-in nothing changes", () => {
  assert.ok(isLocked("approved") && isLocked("building"));
  assert.ok(!isLocked("ready") && !isLocked("review") && !isLocked("done"));
});

test("a change to an approved design keeps it approved (the request waits); one in review goes back to design", () => {
  assert.equal(statusAfter("edit", "approved"), "approved");
  assert.equal(statusAfter("edit", "building"), "building");
  assert.equal(statusAfter("edit", "review"), "ready");
});

test("another bathroom costs more, and says so in the site's money", () => {
  const before = house();
  const out = applyChange(before, { op: "add", kind: "bath", name: "Bathroom" });
  assert.ok(!("error" in out));
  const { delta, text } = costDelta(before, (out as { layout: typeof before }).layout, project);
  assert.ok(delta > 0, `delta ${delta}`);
  assert.match(text, /^\+\$/);
  assert.equal(costDelta(before, before, project).text, "no change to the cost");
});

test("the cost difference reads plainly either way", () => {
  const us = MARKETS[0];
  assert.match(deltaText(3200, us), /^\+\$3\.2K$/);
  assert.match(deltaText(-800, us), /^−\$800$/);
});
