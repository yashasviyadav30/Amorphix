import { test } from "node:test";
import assert from "node:assert/strict";
import { estimate, knownMarket, marketOf, money, MARKETS, type Tier, kitchenSize } from "./costs.ts";
import { priceOf, tierFrom } from "./tier.ts";
import { templateFor } from "../design/program.ts";
import { planOptionsFor } from "../design/options.ts";
import { buildingShell } from "../layout/footprint.ts";
import { DEFAULT_SHELLS } from "../layout/templates.ts";
import type { Entity } from "../qloo/api.ts";

const plan = (t: "house" | "apartment" | "cafe" | "office") => {
  const p = templateFor(t, t === "house" ? 2 : 1);
  return planOptionsFor(p, buildingShell(p, DEFAULT_SHELLS[t]), { space_type: t })[0];
};
const us = MARKETS[0];

test("the site's city picks the market and currency; anywhere else is costed as the US", () => {
  assert.equal(marketOf("Pune").currency, "INR");
  assert.equal(marketOf("Koregaon Park, Pune, Maharashtra").id, "in");
  assert.equal(marketOf("London").currency, "GBP");
  assert.equal(marketOf("Dubai Marina").currency, "AED");
  assert.equal(marketOf("Austin, TX").id, "us");
  assert.equal(marketOf(null).id, "us");
  assert.equal(marketOf("Munich").currency, "EUR");
  assert.ok(knownMarket("Austin, TX") && knownMarket("94110") && knownMarket("Pune"));
  assert.ok(!knownMarket("Lagos, Nigeria"), "an unknown country is flagged, not silently priced as the US");
});

test("every room and trade is costed, and the parts add up to the total", () => {
  const e = estimate(plan("house"), "mid", us);
  const sum = Object.values(e.byCategory).reduce((a, v) => a + v, 0);
  assert.ok(Math.abs(e.total.low - sum * 0.8) < 1 && Math.abs(e.total.high - sum * 1.25) < 1);
  assert.ok(e.byCategory.kitchen! > 0 && e.byCategory.bath! > 0 && e.byCategory.furniture! > 0 && e.byCategory.plants! > 0);
  assert.equal(e.byCategory.construction, undefined, "a renovation doesn't pay for the building");
  assert.ok(e.rooms.some((r) => r.kind === "corridor" && !r.lines.some((l) => l.category === "plants")), "halls get finishes, not plants");
  // A mid-range US house lands in a believable band per m2 of interiors.
  const perM2 = e.total.high / e.area;
  assert.ok(perM2 > 500 && perM2 < 2500, `${perM2.toFixed(0)} USD/m2`);
});

test("tiers, new builds and markets move the price the right way", () => {
  const house = plan("house");
  const at = (t: Tier) => estimate(house, t, us).total.high;
  assert.ok(at("essential") < at("mid") && at("mid") < at("premium") && at("premium") < at("luxury"));
  assert.ok(estimate(house, "mid", us, true).total.high > at("mid") * 2, "the building costs more than its interiors");
  const india = marketOf("Pune");
  const inUsd = estimate(house, "mid", india).total.high / india.fx;
  assert.ok(inUsd < at("mid") * 0.4, "India costs less in dollars");
  // Indian mid-range interiors: roughly ₹800-2,500 per sq ft.
  const perSqft = estimate(house, "mid", india).total.high / (estimate(house, "mid", india).area * 10.764);
  assert.ok(perSqft > 800 && perSqft < 2500, `₹${perSqft.toFixed(0)}/sq ft`);
});

test("a café's kitchen is a commercial one", () => {
  const cafe = estimate(plan("cafe"), "mid", us).rooms.find((r) => r.kind === "kitchen")!;
  const home = estimate(plan("apartment"), "mid", us).rooms.find((r) => r.kind === "kitchen")!;
  const k = (r: typeof cafe) => r.lines.find((l) => l.category === "kitchen")!.amount;
  assert.ok(k(cafe) > k(home) * 1.5);
});

test("money reads the way each market writes it", () => {
  assert.match(money(1840000, marketOf("Pune")), /₹18\.4L/);
  assert.match(money(84000, us), /\$84K/);
});

const ent = (name: string, extra: Partial<Entity> & { properties?: Record<string, unknown> }): Entity => ({ entity_id: name, name, ...extra } as Entity);

test("price signals: hotel stars, a place's price level, a brand's dollar signs", () => {
  assert.deepEqual(priceOf(ent("Ace", { properties: { hotel_class: 4 } })), { name: "Ace", level: 3, says: "a 4-star hotel" });
  assert.deepEqual(priceOf(ent("Cafe", { properties: { price_level: 2 } })), { name: "Cafe", level: 2, says: "moderately priced" });
  assert.deepEqual(priceOf(ent("IKEA", { tags: [{ tag_id: "urn:tag:price_level:qloo:_", name: "$$" }] })), { name: "IKEA", level: 2, says: "a $$ brand" });
  assert.equal(priceOf(ent("Film", {})), null);
});

test("the tier is the average of what they love, and mid-range when nothing says", () => {
  assert.equal(tierFrom([]).tier, "mid");
  assert.equal(tierFrom([{ name: "Taj", level: 4, says: "" }, { name: "Aman", level: 4, says: "" }]).tier, "luxury");
  assert.equal(tierFrom([{ name: "Ace", level: 3, says: "" }, { name: "IKEA", level: 2, says: "" }]).tier, "premium");
  assert.equal(tierFrom([{ name: "IKEA", level: 2, says: "" }, { name: "Diner", level: 1, says: "" }]).tier, "mid");
});

test("every market has its own researched rates, rising with each tier", async () => {
  const { RATES } = await import("./rates.ts");
  for (const m of MARKETS) {
    const r = RATES[m.id];
    assert.ok(r && r.sources.length > 0, `${m.id} has sources`);
    for (const k of ["floor", "paint", "power", "kitchen", "bath", "build"] as const)
      assert.ok(r.essential[k] < r.mid[k] && r.mid[k] < r.premium[k] && r.premium[k] < r.luxury[k], `${m.id} ${k} rises with the tier`);
  }
});

test("mid-range results land inside published ranges for each market", () => {
  const apt = plan("apartment"); // about 89 m2, a 2-bed flat
  const mid = (loc: string) => {
    const m = marketOf(loc);
    const e = estimate(apt, "mid", m, false, loc);
    return (e.total.low + e.total.high) / 2;
  };
  // Published whole-home figures for a similar flat (sources in rates.ts):
  const between = (v: number, lo: number, hi: number, what: string) => assert.ok(v >= lo && v <= hi, `${what}: ${Math.round(v)} not in ${lo}-${hi}`);
  between(mid("Singapore"), 40000, 80000, "Singapore 4-room renovation S$40k-80k");
  between(mid("Dubai"), 130000, 270000, "Dubai mid fit-out AED 150-275/sq ft");
  between(mid("Pune") / (apt.floors[0].spaces.reduce((a, s) => a + s.rect.w * s.rect.h, 0) * 10.764), 800, 1800, "Pune mid ₹800-1,800/sq ft");
});

test("the region moves the price: London above Manchester, Mumbai above Pune, Brooklyn above Austin", () => {
  const h = plan("house");
  const at = (loc: string) => estimate(h, "mid", marketOf(loc), false, loc).total.high;
  assert.ok(at("London") > at("Manchester"));
  assert.ok(at("Mumbai") > at("Pune"));
  assert.ok(at("Brooklyn, NY") > at("Austin, TX"));
  assert.equal(estimate(h, "mid", marketOf("London"), false, "London").region, "London");
});

test("a new build doesn't count floors, wiring and baths twice", () => {
  const h = plan("house");
  const e = estimate(h, "mid", marketOf("Munich"), true, "Munich");
  assert.equal(e.byCategory.finishes, undefined);
  assert.equal(e.byCategory.bath, undefined);
  assert.ok(e.byCategory.construction! > 0 && e.byCategory.kitchen! > 0);
});

test("every screen starts a project's cost at the same quality: what they told us, else their taste, else mid", async () => {
  const { projectTier, toldTier, isNewBuild } = await import("./costs.ts");
  assert.equal(projectTier({ interview: { budget: { level: "premium" } } }, "luxury"), "premium");
  assert.equal(projectTier({ interview: {} }, "luxury"), "luxury");
  assert.equal(projectTier({ interview: null }), "mid");
  assert.equal(toldTier({ interview: { budget: { level: "nonsense" } } }), null);
  assert.ok(isNewBuild({ interview: { project: { newBuild: true } } }));
  assert.ok(!isNewBuild({}));
});

test("a bigger kitchen costs more to fit, gently: about a typical 14 m2 kitchen, never wildly off", () => {
  assert.equal(kitchenSize(14), 1);
  assert.ok(kitchenSize(21) > 1 && kitchenSize(21) < 1.3);
  assert.equal(kitchenSize(4), 0.7);
  assert.equal(kitchenSize(80), 1.6);
});
