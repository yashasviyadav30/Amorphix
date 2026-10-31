import { test } from "node:test";
import assert from "node:assert/strict";
import { fitMargin } from "./fit.ts";

test("a phone or a square frame keeps the full margin", () => {
  assert.equal(fitMargin(0.5), 1.12);
  assert.equal(fitMargin(1), 1.12);
});

test("wider frames come in closer, never closer than the widest step", () => {
  const steps = [1, 1.2, 1.6, 2, 2.4, 3.6].map(fitMargin);
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] <= steps[i - 1]);
  assert.equal(fitMargin(3.6), 0.72);
  assert.equal(fitMargin(10), 0.72);
});
