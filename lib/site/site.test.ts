import { test } from "node:test";
import assert from "node:assert/strict";
import { dayIn, seedMaterials, seedPhases, toImperial } from "./plan.ts";
import { alertsFor, currentPhase, inspects, runsSite, withoutCosts, expectedPct, labourCost, overallPct, stockOf, type PhaseRow } from "./progress.ts";
import { timeline } from "../budget/timeline.ts";
import { estimate, marketOf } from "../budget/costs.ts";
import { placeConcept } from "../layout/concepts.ts";
import { TEMPLATES, DEFAULT_SHELLS } from "../layout/templates.ts";
import { buildingShell } from "../layout/footprint.ts";

const program = TEMPLATES.house;
const house = placeConcept(program, buildingShell(program, DEFAULT_SHELLS.house), "hall-street")!;

test("site phases follow the design's timeline, start on the chosen day and skip design", () => {
  const phases = seedPhases(timeline(house, "mid", false), new Date("2026-11-02T00:00:00Z"));
  assert.ok(!phases.some((p) => p.key === "design"));
  assert.equal(phases[0].start, "2026-11-02");
  assert.ok(phases.every((p) => p.end >= p.start));
  assert.deepEqual(phases.map((p) => p.position), phases.map((_, i) => i));
  assert.ok(!phases.some((p) => p.key === "handover"), "the handover is Move in's, not a site phase");
  assert.equal(phases.at(-1)!.key, "plants");
});

test("materials are taken off the plan, with costs from the budget", () => {
  const est = estimate(house, "mid", marketOf("Pune, India"), false, "Pune, India");
  const m = seedMaterials(house, est, false);
  const floor = m.find((x) => x.name === "Flooring")!;
  assert.ok(floor.needed > 50 && floor.unitCost > 0, JSON.stringify(floor));
  assert.ok(m.some((x) => x.name === "Kitchen units" && x.needed === 1));
  assert.ok(!m.some((x) => x.name === "Cement")); // a fit-out has no structure
  const built = seedMaterials(house, estimate(house, "mid", marketOf("Pune, India"), true, "Pune, India"), true);
  assert.ok(built.some((x) => x.name === "Cement" && x.phase === "structure"));
});

const phase = (o: Partial<PhaseRow>): PhaseRow => ({ id: 1, key: "finishes", name: "Floors, walls and ceilings", start_date: "2026-11-01", end_date: "2026-11-10", status: "active", pct: 0, ...o });

test("expected progress runs evenly between a phase's dates; overall weights by length", () => {
  assert.equal(expectedPct(phase({}), "2026-10-30"), 0);
  assert.equal(expectedPct(phase({}), "2026-11-05"), 50);
  assert.equal(expectedPct(phase({}), "2026-12-01"), 100);
  assert.equal(overallPct([phase({ pct: 100 }), phase({ pct: 0, start_date: "2026-11-11", end_date: "2026-11-30" })]), 33);
  assert.equal(currentPhase([phase({ status: "done" }), phase({ id: 2 })])!.id, 2);
});

test("alerts: late and behind phases, overdue tasks, low stock for the phase in hand, nobody on site", () => {
  const a = alertsFor({
    phases: [phase({ id: 1, key: "services", name: "Electrical and plumbing", start_date: "2026-10-20", end_date: "2026-10-31", pct: 70 }), phase({ id: 2, pct: 10 })],
    tasks: [{ id: 1, title: "Lay tiles", due: "2026-11-03", status: "todo", phase_id: 2 }],
    materials: [{ id: 1, name: "Electrical points", unit: "points", needed: 60, ordered: 40, delivered: 40, used: 38, unit_cost: 0, phase: "services" }],
    onSiteToday: 0,
    today: "2026-11-06", // a Friday
  });
  const kinds = a.map((x) => x.kind);
  assert.deepEqual(kinds, ["late", "behind", "overdue", "stock", "empty"]);
  assert.match(a[3].text, /2 points on site, 22 still needed/);
});

test("a calm site has no alerts; weekends don't count for attendance", () => {
  const a = alertsFor({ phases: [phase({ pct: 60 })], tasks: [], materials: [], onSiteToday: 0, today: "2026-11-07" }); // Saturday
  assert.deepEqual(a, []);
});

test("stock and labour add up", () => {
  assert.deepEqual(stockOf({ needed: 100, ordered: 70, delivered: 50, used: 20 }), { onSite: 30, coming: 20, toOrder: 30 });
  assert.equal(labourCost([{ present: true, hours: 8, day_rate: 1000 }, { present: true, hours: 4, day_rate: 1000 }, { present: false, hours: 8, day_rate: 1000 }]), 1500);
});

test("today is the person's own day, not the server's", () => {
  const late = new Date("2026-10-13T22:16:00Z"); // 3:46am on the 14th in India
  assert.equal(dayIn("Asia/Kolkata", late), "2026-10-14");
  assert.equal(dayIn("America/New_York", late), "2026-10-13");
  assert.equal(dayIn(undefined, late), "2026-10-13");
  assert.equal(dayIn("Not/AZone", late), "2026-10-13");
});

test("the builder runs the site; an owner only in pro mode or when managing the build themselves", () => {
  assert.ok(runsSite("builder", "owner"));
  assert.ok(!runsSite("owner", "owner"));
  assert.ok(runsSite("owner", "owner", true));
  assert.ok(runsSite("owner", "pro"));
  assert.ok(!runsSite("client", "owner", true));
  assert.ok(!runsSite("architect", "pro", true));
  // one side runs a site: in a pro's project, the builder once there is one
  assert.ok(!runsSite("owner", "pro", false, true));
  assert.ok(runsSite("builder", "pro", false, true));
});

test("the client sees the budget and progress, not the builder's own costs", () => {
  const site = {
    overall: 40,
    crew: [{ id: 1, name: "Sunil", trade: "Tiler", day_rate: 120 }],
    materials: [{ id: 1, name: "Flooring", needed: 218, unit_cost: 68 }],
    orders: [{ id: 1, qty: 218, supplier: "City Floors", cost: 14824 }],
    money: { labour: 120, materials: 14824, spent: 14944, budget: { low: 96241, high: 150376 }, currency: "USD" },
  };
  const seen = withoutCosts(site);
  assert.equal(seen.overall, 40);
  assert.deepEqual(seen.crew, [{ id: 1, name: "Sunil", trade: "Tiler" }]);
  assert.deepEqual(seen.materials, [{ id: 1, name: "Flooring", needed: 218 }]);
  assert.deepEqual(seen.orders, [{ id: 1, qty: 218, supplier: "City Floors" }]);
  assert.deepEqual(seen.money, { budget: { low: 96241, high: 150376 }, quoted: undefined, currency: "USD" });
  assert.ok(!JSON.stringify(seen).includes("14944") && !JSON.stringify(seen).includes("120,"));
  // an accepted quote is one price, and the client still sees it as the quote, not a range
  const quoted = withoutCosts({ ...site, money: { ...site.money, budget: { low: 395000, high: 395000 }, quoted: true } });
  assert.deepEqual(quoted.money, { budget: { low: 395000, high: 395000 }, quoted: true, currency: "USD" });
});

test("the architect visits and signs off stages: the architect on it, or an architect whose own project it is", () => {
  assert.equal(inspects("architect", "owner", null), true);
  assert.equal(inspects("owner", "pro", "architect"), true);
  assert.equal(inspects("owner", "pro", "builder"), false);
  assert.equal(inspects("builder", "pro", "architect"), false);
  assert.equal(inspects("client", "pro", "architect"), false);
  assert.equal(inspects("owner", "owner", null), false);
});

test("a US site orders in sq ft and pounds, at the same total cost", () => {
  const m = toImperial({ name: "Flooring", unit: "m²", needed: 100, unitCost: 50, phase: "finishes" });
  assert.equal(m.unit, "sq ft");
  assert.equal(m.needed, 1076);
  assert.ok(Math.abs(m.needed * m.unitCost - 100 * 50) < 10);
  assert.equal(toImperial({ name: "Steel", unit: "kg", needed: 10, unitCost: 2, phase: "structure" }).unit, "lb");
  assert.equal(toImperial({ name: "Cement", unit: "bags", needed: 5, unitCost: 9, phase: "structure" }).unit, "bags");
});
