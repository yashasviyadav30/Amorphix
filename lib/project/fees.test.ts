import { test } from "node:test";
import assert from "node:assert/strict";
import { actionsFor, money, sideOf, standardSplit, step, dueWhen, phaseSplit } from "./fees.ts";

test("who bills and who pays", () => {
  assert.equal(sideOf("architect", "owner"), "pro");
  assert.equal(sideOf("builder", "owner"), "pro");
  assert.equal(sideOf("owner", "owner"), "payer"); // a homeowner's own project
  assert.equal(sideOf("owner", "pro"), "pro"); // an architect's client project
  assert.equal(sideOf("client", "pro"), "payer");
  assert.equal(sideOf("viewer", "owner"), null);
});

test("billed by the pro, marked paid by the payer, confirmed by the pro, in that order", () => {
  assert.equal(step("planned", "bill", "pro"), "billed");
  assert.equal(step("planned", "bill", "payer"), null);
  assert.equal(step("billed", "paid", "payer"), "claimed");
  assert.equal(step("billed", "paid", "pro"), null);
  assert.equal(step("claimed", "received", "pro"), "received");
  assert.equal(step("billed", "received", "pro"), "received");
  assert.equal(step("planned", "received", "pro"), null);
  assert.equal(step("received", "bill", "pro"), null);
});

test("each side sees only its buttons", () => {
  assert.deepEqual(actionsFor("planned", "pro"), ["bill"]);
  assert.deepEqual(actionsFor("billed", "payer"), ["paid"]);
  assert.deepEqual(actionsFor("billed", "pro"), ["received"]);
  assert.deepEqual(actionsFor("received", "pro"), []);
  assert.deepEqual(actionsFor("billed", null), []);
});

test("the standard split adds up to the total", () => {
  const parts = standardSplit(250001);
  assert.deepEqual(parts.map((p) => p.label), ["Design", "Approval of the final design", "Handover"]);
  assert.equal(parts.reduce((s, p) => s + p.amount, 0), 250001);
  assert.equal(parts[0].amount, 75000);
});

test("money reads the local way", () => {
  assert.equal(money(250000, "INR"), "₹2,50,000");
  assert.equal(money(4000, "USD"), "$4,000");
});

test("a builder is paid by stage of the build, an architect by stage of the design; both add up", () => {
  const b = standardSplit(450001, "builder");
  assert.deepEqual(b.map((p) => p.label), ["Deposit", "Foundations and structure", "Electrical and plumbing", "Finishes", "Handover"]);
  assert.equal(b.reduce((n, p) => n + p.amount, 0), 450001);
  assert.equal(standardSplit(100, "architect")[0].label, "Design");
});

test("a builder's fee follows the site's phases: deposit, each phase by how long it runs, handover; it adds up", () => {
  const phases = [
    { key: "structure", name: "Foundations and structure", days: 60 },
    { key: "services", name: "Electrical and plumbing", days: 20 },
    { key: "finishes", name: "Floors, walls and ceilings", days: 20 },
  ];
  const s = phaseSplit(100_001, phases);
  assert.deepEqual(s.map((p) => p.phase), ["start", "structure", "services", "finishes", "handover"]);
  assert.equal(s.reduce((n, p) => n + p.amount, 0), 100_001);
  assert.equal(s[1].amount, 48_000); // 60% of the 80%
  assert.equal(dueWhen("services", phases), "when Electrical and plumbing finishes");
  assert.equal(dueWhen("start", phases), "when the site starts");
  assert.equal(dueWhen(null, phases), null);
  // no site yet: the usual builder stages, each tied to a phase
  assert.ok(phaseSplit(1000, []).every((p) => p.phase));
});
