import { test } from "node:test";
import assert from "node:assert/strict";
import { ledger, OVERDUE_DAYS, type FeeRow } from "./ledger.ts";
import { crewWeek, tapSite, weekOf } from "./crew.ts";

const NOW = new Date("2026-10-20T12:00:00Z").getTime();
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
const fee = (over: Partial<FeeRow>): FeeRow => ({ id: 1, project_id: "a", label: "Design", amount: 1000, currency: "USD", status: "planned", billed_at: null, ...over });

test("a pro's fees come in; the client's go out", () => {
  const projects = [
    { id: "a", name: "LA house", role: "architect", mode: "owner" as const },
    { id: "b", name: "My café", role: "client", mode: "pro" as const },
  ];
  const { lines } = ledger([fee({ id: 1, project_id: "a" }), fee({ id: 2, project_id: "b", status: "billed", billed_at: ago(1) })], projects, NOW);
  assert.equal(lines.find((l) => l.id === 1)?.side, "in");
  assert.equal(lines.find((l) => l.id === 2)?.side, "out");
  assert.deepEqual(lines.find((l) => l.id === 2)?.actions, ["paid"]);
});

test("billed and unpaid for two weeks is overdue, and counted", () => {
  const projects = [{ id: "a", name: "LA house", role: "architect", mode: "owner" as const }];
  const { lines, totals } = ledger([fee({ status: "billed", billed_at: ago(OVERDUE_DAYS) }), fee({ id: 2, status: "billed", billed_at: ago(3), amount: 500 })], projects, NOW);
  assert.equal(lines.filter((l) => l.overdue).length, 1);
  assert.equal(totals[0].billed, 1500);
  assert.equal(totals[0].overdue, 1000);
});

test("what needs this person comes first, settled fees last", () => {
  const projects = [{ id: "a", name: "LA house", role: "architect", mode: "owner" as const }];
  const { lines } = ledger(
    [fee({ id: 1, status: "received" }), fee({ id: 2, status: "planned" }), fee({ id: 3, status: "claimed" })],
    projects,
    NOW,
  );
  assert.deepEqual(lines.map((l) => l.id), [3, 2, 1]);
  assert.equal(lines[0].next, "They say it's paid: confirm");
});

test("viewers and unknown projects carry no fees", () => {
  const { lines } = ledger([fee({ project_id: "a" }), fee({ id: 2, project_id: "zz" })], [{ id: "a", name: "x", role: "viewer", mode: "owner" }], NOW);
  assert.equal(lines.length, 0);
});

test("totals are kept apart by currency", () => {
  const projects = [{ id: "a", name: "x", role: "builder", mode: "owner" as const }];
  const { totals } = ledger([fee({ status: "received" }), fee({ id: 2, status: "received", currency: "INR", amount: 5 })], projects, NOW);
  assert.equal(totals.length, 2);
});

test("the week runs Monday to Sunday", () => {
  const w = weekOf("2026-10-22"); // a Thursday
  assert.equal(w[0], "2026-10-19");
  assert.equal(w[6], "2026-10-25");
  assert.equal(weekOf("2026-10-19")[0], "2026-10-19");
  assert.equal(weekOf("2026-10-25")[0], "2026-10-19");
});

test("each worker's week: days on site, hours, and pay at their day rate", () => {
  const crew = [
    { id: 1, name: "Ana", trade: "Carpenter", phone: null, day_rate: 240 },
    { id: 2, name: "Ben", trade: "Electrician", phone: null, day_rate: 320 },
  ];
  const links = [{ project_id: "s1", crew_id: 1 }, { project_id: "s2", crew_id: 1 }, { project_id: "s1", crew_id: 2 }];
  const att = [
    { project_id: "s1", crew_id: 1, day: "2026-10-19", present: true, hours: 8 },
    { project_id: "s2", crew_id: 1, day: "2026-10-20", present: true, hours: 4 },
    { project_id: "s1", crew_id: 1, day: "2026-10-12", present: true, hours: 8 }, // last week
    { project_id: "s1", crew_id: 2, day: "2026-10-20", present: false, hours: 0 },
  ];
  const { lines, onSite, earned } = crewWeek(crew, links, att, "2026-10-20");
  const ana = lines.find((l) => l.name === "Ana")!;
  assert.equal(ana.days, 2);
  assert.equal(ana.hours, 12);
  assert.equal(ana.earned, 360); // a full day and a half day
  assert.deepEqual(ana.sites, ["s1", "s2"]);
  assert.deepEqual(ana.here, ["s2"]);
  const ben = lines.find((l) => l.name === "Ben")!;
  assert.deepEqual(ben.here, []);
  assert.equal(ben.marked, true);
  assert.equal(ben.earned, 0);
  assert.equal(onSite, 1);
  assert.equal(earned, 360);
  assert.equal(lines[0].name, "Ana", "on site today leads");
});

test("a tap on another site moves the worker; a tap where they are takes them off", () => {
  assert.deepEqual(tapSite([], "b"), [{ project_id: "b", present: true }]);
  assert.deepEqual(tapSite(["a"], "b"), [{ project_id: "a", present: false }, { project_id: "b", present: true }]);
  assert.deepEqual(tapSite(["b"], "b"), [{ project_id: "b", present: false }]);
});

test("on a project with two pros, each sees only the fees they set out; the client sees both", () => {
  const rows = [fee({ id: 1, created_by: "arch" }), fee({ id: 2, created_by: "build", amount: 9000 })];
  const as = (role: string, me: string) => ledger(rows, [{ id: "a", name: "LA house", role, mode: "owner" }], NOW, me).lines.map((l) => l.id);
  assert.deepEqual(as("architect", "arch"), [1]);
  assert.deepEqual(as("builder", "build"), [2]);
  assert.deepEqual(as("owner", "owner1").sort(), [1, 2]);
});
