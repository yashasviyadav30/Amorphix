import { test } from "node:test";
import assert from "node:assert/strict";
import { canLeave, isStep, nextStep, STEPS } from "./steps.ts";

test("steps run in the agreed order", () => {
  assert.deepEqual(STEPS.map((s) => s.id), ["brief", "plans", "walkthrough", "budget", "shop", "workspace", "drawings"]);
});

test("next moves forward and ends at share and export, the way out of the loop", () => {
  assert.equal(nextStep("brief"), "plans");
  assert.equal(nextStep("workspace"), "drawings");
  assert.equal(nextStep("drawings"), null);
});

test("the plans step needs a chosen plan before moving on", () => {
  assert.equal(canLeave("plans", { chosen_option: null }), false);
  assert.equal(canLeave("plans", { chosen_option: 0 }), true);
  assert.equal(canLeave("brief", { chosen_option: null }), true);
});

test("only known step names are accepted from storage", () => {
  assert.equal(isStep("budget"), true);
  assert.equal(isStep("admin"), false);
  assert.equal(isStep(null), false);
});
