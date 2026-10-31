import { test } from "node:test";
import assert from "node:assert/strict";
import { compare, measure, sayClaim } from "./compare.ts";
import { planOptionsFor } from "./options.ts";
import { TEMPLATES } from "../layout/templates.ts";
import { voiceProblems } from "../voice.ts";
import type { Layout } from "../layout/schema.ts";

const plans = planOptionsFor(TEMPLATES.house, { width: 13, depth: 8.4 });

// A tiny one-room-per-kind layout for exact checks.
const fake = (living: number, kitchen: number): Layout => ({
  spaceType: "house",
  shell: { width: 20, depth: 10 },
  floors: [{ level: 0, openings: [], spaces: [
    { id: "l", name: "Living", kind: "living", zone: "public", rect: { x: 0, y: 0, w: living, h: 1 } },
    { id: "k", name: "Kitchen", kind: "kitchen", zone: "public", rect: { x: 10, y: 0, w: kitchen, h: 1 } },
    { id: "h", name: "Hall", kind: "corridor", zone: "circulation", rect: { x: 0, y: 5, w: 2, h: 1 } },
  ] }],
});

test("each option's claims come from measured areas", () => {
  const out = compare([fake(30, 10), fake(20, 14), fake(25, 12)]);
  const has = (o: { gains: { measure: string; value: number }[] }, m: string, v?: number) => o.gains.some((c) => c.measure === m && (v === undefined || c.value === v));
  assert.ok(has(out[0], "living", 30));
  assert.equal(out[0].gives[0].measure, "kitchen");
  assert.ok(has(out[1], "kitchen", 14));
  assert.ok(out[1].gives.length === 1);
  assert.ok(!has(out[2], "living") && !has(out[2], "kitchen"), "the middle option claims neither");
});

test("small differences and ties make no claim", () => {
  const out = compare([fake(30, 10), fake(29, 10), fake(30, 10)]);
  for (const o of out) assert.deepEqual([...o.gains, ...o.gives], []);
});

test("the real three plans each say something, and the lines follow the voice rules", () => {
  const out = compare(plans);
  assert.equal(out.length, 3);
  assert.ok(out.some((o) => o.gains.length > 0));
  for (const o of out)
    for (const c of [...o.gains, ...o.gives]) {
      const line = sayClaim(c);
      assert.deepEqual(voiceProblems(line), [], line);
      assert.match(line, /\d/);
    }
});

test("halls are a share of the floor, lower is better, and units follow the project", () => {
  const m = measure(plans[0]);
  assert.ok(m.halls > 0 && m.halls < 0.5);
  assert.match(sayClaim({ measure: "living", value: 30, best: true }, "metric"), /30 m²/);
  assert.match(sayClaim({ measure: "living", value: 30, best: true }, "imperial"), /325 sq ft/);
});
