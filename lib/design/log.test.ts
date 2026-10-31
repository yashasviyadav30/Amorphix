import { test } from "node:test";
import assert from "node:assert/strict";
import { processingLog } from "./log.ts";

const project = {
  space_type: "house",
  site: { width: 12.19, depth: 18.29, floors: 2, location: "Austin, TX" },
  interview: { people: {}, needs: {} },
  taste_signals: [
    { name: "Ace Hotel New York", layer: 1 as const },
    { name: "Norah Jones", layer: 3 as const },
  ],
  taste: {
    tags: [
      { family: "decor", value: "post_industrial", sources: [{ name: "Ace Hotel New York" }] },
      { family: "ambience", value: "moodily_dark", sources: [{ name: "Ace Hotel New York" }] },
    ],
    brands: [{ name: "Pottery Barn" }],
  },
};

test("the log is built from the project's own data", () => {
  const log = processingLog(project);
  assert.equal(log[0], "> load project · house · Austin, TX");
  assert.equal(log[1], "> site 12.2 × 18.3 m · 2 floors");
  assert.equal(log[2], "> interview parsed · people, needs");
  assert.ok(log.includes("> taste graph · place · Ace Hotel New York → decor: post industrial, ambience: moodily dark"));
  assert.ok(log.includes("> taste graph · culture · Norah Jones"));
  assert.ok(log.includes("> style vector · post industrial · moodily dark"));
  assert.ok(log.includes("> matched brands · Pottery Barn"));
  assert.match(log.at(-1)!, /3 plans/);
});

test("a bare project still gives a sensible log", () => {
  const log = processingLog({ space_type: null, site: {}, interview: {}, taste_signals: [], taste: null });
  assert.equal(log[0], "> load project · space · location unknown");
  assert.equal(log.length, 4);
});
