import { test } from "node:test";
import assert from "node:assert/strict";
import { canSendForReview, eventText, statusAfter } from "./review.ts";

test("events read as plain sentences in the thread", () => {
  assert.equal(eventText({ type: "review", version: 3 }, "Ana"), "Ana sent version 3 for review.");
  assert.equal(eventText({ type: "approved", version: 3, note: "Love it" }, "Priya"), 'Priya approved version 3. "Love it"');
  assert.equal(eventText({ type: "changes", version: 3 }, "Priya"), "Priya asked for changes to version 3.");
  assert.equal(eventText({ type: "changed", version: 4, note: "Kitchen bigger" }, "Ana"), "Ana changed the design: Kitchen bigger (version 4).");
  assert.equal(eventText({ type: "joined", role: "builder" }, "Raj"), "Raj joined as the builder.");
  assert.equal(eventText({ type: "fee", action: "bill", label: "Design", amount: "₹75,000" }, "Ana"), "Ana billed Design: ₹75,000.");
  assert.equal(eventText({ type: "fee", action: "paid", label: "Design", amount: "₹75,000" }, "Priya"), "Priya marked Design as paid (₹75,000).");
  assert.equal(eventText({ type: "handover", to: "Test Studio" }, "Vicky"), "Vicky handed the project over to Test Studio, who now runs it. Vicky stays on as the client.");
});

test("review only once a plan is chosen, and not twice", () => {
  assert.equal(canSendForReview({ status: "ready", chosen_option: null }), false);
  assert.equal(canSendForReview({ status: "ready", chosen_option: 1 }), true);
  assert.equal(canSendForReview({ status: "review", chosen_option: 1 }), false);
  assert.equal(canSendForReview({ status: "approved", chosen_option: 1 }), false);
});

test("a change in review goes back to design; a change to an approved design waits as a change request", () => {
  assert.equal(statusAfter("send", "ready"), "review");
  assert.equal(statusAfter("approve", "review"), "approved");
  assert.equal(statusAfter("changes", "review"), "ready");
  assert.equal(statusAfter("edit", "approved"), "approved");
  assert.equal(statusAfter("edit", "review"), "ready");
  assert.equal(statusAfter("edit", "designing"), "designing");
  assert.equal(statusAfter("edit", "building"), "building");
});

test("a client's answer given in person reads as theirs, recorded by the pro", () => {
  assert.equal(eventText({ type: "approved", version: 2, for: "Priya" }, "Sam"), "Priya approved version 2 in person (recorded by Sam).");
  assert.equal(eventText({ type: "changes", version: 2, note: "Bigger kitchen", for: "Priya" }, "Sam"), 'Priya asked for changes to version 2 in person (recorded by Sam). "Bigger kitchen"');
});
