import { test } from "node:test";
import assert from "node:assert/strict";
import { next, problems, toProject } from "../interview/script.ts";
import { ANA, MAYA, PARKS, SAM } from "./story.ts";

test("every demo story answers the whole interview, with nothing the finish route would refuse", () => {
  for (const [name, a] of Object.entries({ MAYA, PARKS, ANA, SAM })) {
    assert.equal(next(a), null, `${name} leaves a question open`);
    assert.deepEqual(problems(a), [], name);
  }
});

test("Maya's answers make a two-floor house in Los Angeles, in feet", () => {
  const p = toProject(MAYA, "en");
  assert.equal(p.space_type, "house");
  assert.equal(p.site.floors, 2);
  assert.equal(p.site.location, "Los Angeles, CA");
  assert.equal(p.site.units, "imperial");
  assert.deepEqual((p.interview.people as { kids: number[] }).kids, [3, 8]);
});
