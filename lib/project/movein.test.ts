import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccept, moveInChecks, ratingLine, snagActions, snagStep, validRating, warrantyUntil } from "./movein.ts";

const builder = { runs: true, decides: false };
const client = { runs: false, decides: true };
const selfBuild = { runs: true, decides: true };

test("the builder fixes a snag; the client confirms it or sends it back", () => {
  assert.equal(snagStep("open", "fix", builder), "fixed");
  assert.equal(snagStep("fixed", "close", client), "closed");
  assert.equal(snagStep("fixed", "reopen", client), "open");
  assert.equal(snagStep("open", "fix", client), null, "the client doesn't mark their own snags fixed");
  assert.equal(snagStep("fixed", "close", builder), null, "the builder doesn't sign off their own fix");
  assert.equal(snagStep("closed", "reopen", client), null);
});

test("an owner building it themselves closes snags in one step", () => {
  assert.equal(snagStep("open", "close", selfBuild), "closed");
  assert.deepEqual(snagActions("open", selfBuild), ["fix", "close"]);
  assert.deepEqual(snagActions("open", { runs: false, decides: false }), []);
});

test("the handover is accepted only once every phase is done, and only once", () => {
  assert.ok(canAccept({ status: "building", allDone: true }));
  assert.ok(!canAccept({ status: "building", allDone: false }));
  assert.ok(!canAccept({ status: "done", allDone: true }));
});

test("the warranty runs from the handover day", () => {
  assert.equal(warrantyUntil("2026-11-15T10:00:00Z", 12), "2027-11-15");
  assert.equal(warrantyUntil(null, 12), null);
  assert.equal(warrantyUntil("2026-11-15T10:00:00Z", 0), null);
});

test("the steps to moving in say what's left", () => {
  const c = moveInChecks({ allDone: true, snags: [{ status: "closed" }, { status: "fixed" }], warrantyMonths: null, feesOpen: 1, handedOver: false });
  assert.deepEqual(c.map((x) => x.done), [true, false, false, false, false]);
  assert.equal(c[1].note, "1 of 2 still open");
  assert.equal(c[3].note, "1 not received yet");
  const all = moveInChecks({ allDone: true, snags: [], warrantyMonths: 12, feesOpen: 0, handedOver: true });
  assert.ok(all.every((x) => x.done));
});

test("ratings are one to five whole stars, and read plainly", () => {
  assert.ok(validRating(5) && validRating(1));
  assert.ok(!validRating(0) && !validRating(6) && !validRating(4.5) && !validRating("5"));
  assert.equal(ratingLine([5, 4, 5]), "★ 4.7 · 3 reviews");
  assert.equal(ratingLine([]), null);
});

test("the walk-through isn't done until someone has walked through: a finished build with no snags listed waits", () => {
  const base = { allDone: true, warrantyMonths: null, feesOpen: 0, handedOver: false };
  const walk = (s: Parameters<typeof moveInChecks>[0]) => moveInChecks(s).find((c) => c.id === "snags")!.done;
  assert.equal(walk({ ...base, snags: [] }), false);
  assert.equal(walk({ ...base, snags: [{ status: "closed" }] }), true);
  assert.equal(walk({ ...base, snags: [], handedOver: true }), true);
});

test("building it yourself, there's no handover pack step", () => {
  const s = { allDone: true, snags: [], warrantyMonths: null, feesOpen: 0, handedOver: false };
  assert.equal(moveInChecks({ ...s, selfBuild: true }).some((c) => c.id === "pack"), false);
  assert.equal(moveInChecks(s).some((c) => c.id === "pack"), true);
});
