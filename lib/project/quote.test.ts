import { test } from "node:test";
import assert from "node:assert/strict";
import { againstEstimate, canSendQuote, siteBudget } from "./quote.ts";

test("only the builder prices the build: the builder on it, or a builder whose own project it is", () => {
  assert.equal(canSendQuote("builder", null), true);
  assert.equal(canSendQuote("owner", "builder"), true);
  assert.equal(canSendQuote("owner", "architect"), false);
  assert.equal(canSendQuote("owner", null), false);
  assert.equal(canSendQuote("architect", null), false);
  assert.equal(canSendQuote("client", null), false);
});

test("a quote is read against Amorphix's estimate in plain words", () => {
  assert.deepEqual(againstEstimate(500_000, 400_000, 600_000), { side: "within", text: "within Amorphix's estimate" });
  assert.equal(againstEstimate(660_000, 400_000, 600_000).text, "10% above Amorphix's estimate");
  assert.equal(againstEstimate(360_000, 400_000, 600_000).text, "10% below Amorphix's estimate");
});

test("an accepted quote is the site's budget; until then the estimate is", () => {
  assert.deepEqual(siteBudget({ low: 1, high: 2 }, null), { low: 1, high: 2 });
  assert.deepEqual(siteBudget({ low: 1, high: 2 }, { amount: 5 }), { low: 5, high: 5 });
  assert.equal(siteBudget(null, null), null);
});
