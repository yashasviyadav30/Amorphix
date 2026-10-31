import { test } from "node:test";
import assert from "node:assert/strict";
import { risk } from "./risk.ts";
import { MARKETS, type Estimate } from "./costs.ts";

// A synthetic estimate: only the trade totals and the range matter to the risk model.
const est = (byCategory: Estimate["byCategory"], tier: Estimate["tier"] = "mid"): Estimate => {
  const point = Object.values(byCategory).reduce((a, v) => a + (v ?? 0), 0);
  return { tier, market: MARKETS[0], region: null, rooms: [], byCategory, total: { low: point * 0.8, high: point * 1.25 }, area: 80 };
};
const fitOut = est({ finishes: 30000, electrical: 10000, kitchen: 25000, bath: 15000, furniture: 20000, plants: 500, fees: 10050 });

test("the percentiles climb, and the planned figure is the sum of the trades", () => {
  const r = risk(fitOut);
  assert.equal(r.planned, 110550);
  assert.ok(r.p50 < r.p80 && r.p80 < r.p90);
  assert.ok(r.contingency > 0 && Math.abs(r.contingency - (r.p80 - r.planned)) < 1e-6);
});

test("overruns are likelier than savings, but rarely past the top of the range", () => {
  const r = risk(fitOut);
  assert.ok(r.over > 0.5 && r.over < 0.8, `over ${r.over}`);
  assert.ok(r.overRange < 0.1, `over range ${r.overRange}`);
});

test("a renovation is riskier than the same work in a new building", () => {
  assert.ok(risk(fitOut, false).p90 > risk(fitOut, true).p90);
});

test("luxury work carries more risk than essential work of the same cost", () => {
  const lux = risk(est(fitOut.byCategory, "luxury"));
  const ess = risk(est(fitOut.byCategory, "essential"));
  assert.ok(lux.p90 - lux.p50 > ess.p90 - ess.p50);
});

test("the drivers are the biggest uncertain trades, and the same design gives the same figures", () => {
  const r = risk(fitOut);
  assert.equal(r.drivers[0].category, "finishes");
  assert.ok(r.drivers.every((d) => d.share > 0 && d.share <= 1));
  assert.deepEqual(risk(fitOut), r);
});

test("nothing to cost, no risk", () => {
  assert.deepEqual(risk(est({})), { planned: 0, p50: 0, p80: 0, p90: 0, over: 0, overRange: 0, contingency: 0, drivers: [] });
});
