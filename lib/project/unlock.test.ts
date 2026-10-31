import { test } from "node:test";
import assert from "node:assert/strict";
import { proActive, proUntil } from "./unlock.ts";

const day = 86_400_000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
const pro = (o: Partial<{ plan: string; plan_until: string | null; trial_until: string | null; demo: boolean }>) => ({ plan: "free", plan_until: null, trial_until: null, demo: false, ...o });

test("a pro's access runs to the later of their plan and their trial", () => {
  assert.equal(proUntil(pro({ trial_until: "2026-10-27T00:00:00Z" })), "2026-10-27T00:00:00Z");
  assert.equal(proUntil(pro({ plan: "pro", plan_until: "2027-10-01T00:00:00Z", trial_until: "2026-10-27T00:00:00Z" })), "2027-10-01T00:00:00Z");
  assert.equal(proUntil(pro({ plan: "free", plan_until: "2027-10-01T00:00:00Z" })), null); // a date on a free plan counts for nothing
});

test("New client needs a live plan or trial (or a demo account)", () => {
  assert.equal(proActive(pro({ trial_until: iso(3 * day) })), true);
  assert.equal(proActive(pro({ trial_until: iso(-day) })), false);
  assert.equal(proActive(pro({ plan: "build", plan_until: iso(30 * day) })), true);
  assert.equal(proActive(pro({ demo: true })), true);
  assert.equal(proActive(null), false);
});
