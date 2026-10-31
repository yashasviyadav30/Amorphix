import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanNames, describePrompt, matchAnswers, MAX_NAMES } from "./describe.ts";

test("names are trimmed, deduplicated and capped", () => {
  assert.deepEqual(cleanNames(["  Muji ", "muji", "", 3, "West   Elm"]), ["Muji", "West Elm"]);
  assert.equal(cleanNames(Array.from({ length: 20 }, (_, i) => `n${i}`)).length, MAX_NAMES);
  assert.deepEqual(cleanNames("not a list"), []);
});

test("the prompt lists every name and asks for kind and description", () => {
  const p = describePrompt(["Chateau Marmont", "Mad Men"]);
  assert.ok(p.includes("- Chateau Marmont") && p.includes("- Mad Men"));
  assert.ok(p.includes("kind:") && p.includes("description:"));
});

test("answers follow the asked order, and the kind sets the layer", () => {
  const got = matchAnswers(["Chateau Marmont", "Muji"], [
    { name: "muji", kind: "brand", description: "minimal Japanese design, pale oak" },
    { name: "Chateau Marmont", kind: "place", description: "old Hollywood glamour, dark wood" },
  ]);
  assert.deepEqual(got.map((d) => [d.name, d.layer]), [["Chateau Marmont", 1], ["Muji", 2]]);
});

test("a missing answer falls back to the name itself as a place", () => {
  const [d] = matchAnswers(["A café I love"], []);
  assert.equal(d.description, "A café I love");
  assert.equal(d.kind, "place");
});
