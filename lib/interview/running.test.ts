import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeRunning, runningMissing, runningOf, runningSizes } from "./running.ts";
import { rank, planOptionsFor } from "../design/options.ts";
import { templateFor } from "../design/program.ts";
import { buildingShell } from "../layout/footprint.ts";
import { DEFAULT_SHELLS } from "../layout/templates.ts";

test("each business is asked only what changes its plan; homes are never asked", () => {
  assert.match(runningMissing("cafe", {})!, /sit down or take away.*cook full meals/);
  assert.match(runningMissing("office", { work: "focus" })!, /how many people/);
  assert.equal(runningMissing("office", { work: "focus", people: 0 }), null, "a count of 0 is an answer");
  assert.match(runningMissing("shop", {})!, /browse/);
  assert.match(runningMissing("hotel", {})!, /guest rooms/);
  assert.equal(runningMissing("house", {}), null);
  assert.equal(runningMissing(null, {}), null);
});

test("answers merge; impossible counts are dropped and quotes trimmed", () => {
  const r = mergeRunning({ service: "takeaway", said: { service: "  to go  " } }, { seats: 24.6, people: -3, rooms: 9000, said: { seats: "x".repeat(300) } });
  assert.equal(r.service, "takeaway");
  assert.equal(r.seats, 25);
  assert.equal(r.people, undefined);
  assert.equal(r.rooms, undefined);
  assert.equal(r.said!.service, "to go");
  assert.equal(r.said!.seats.length, 140);
  assert.deepEqual(runningOf({ running: { service: "drive-through" } }), {}, "a malformed save is ignored, not trusted");
  assert.equal(mergeRunning({}, { said: { people: "12 people in a design studio" } }).people, 12, "a count only quoted is still saved");
  assert.equal(mergeRunning({ people: 8 }, { said: { people: "we're growing to 20 soon" } }).people, 8, "a quote never overrides a saved count");
});

test("their numbers become sizing lines for the room program", () => {
  assert.match(runningSizes("cafe", { seats: 30, service: "takeaway", kitchen: "prep" }).join(" "), /Seat 30.*fewer if most people take away.*small prep kitchen.*queue/);
  assert.match(runningSizes("office", { people: 12, work: "focus", visitors: true }).join(" "), /12 people.*focus room.*reception/);
  assert.deepEqual(runningSizes("shop", { fittingRooms: 0 }), ["No fitting rooms."]);
  assert.deepEqual(runningSizes("house", { seats: 30 }), []);
});

const top = (space_type: string, running: object) => rank({ space_type, interview: { running } })[0];

test("how a business runs picks the plan, with the reason in their words", () => {
  const takeaway = top("cafe", { service: "takeaway", said: { service: "students grab coffee to go" } });
  assert.equal(takeaway.id, "hall-street");
  assert.match(takeaway.why[0], /^You said "students grab coffee to go", so the counter faces the street/);
  assert.equal(top("cafe", { service: "dine-in" }).id, "great-room");
  assert.equal(top("cafe", { outdoor: true }).id, "hall-garden");
  assert.equal(top("office", { work: "focus" }).id, "split");
  assert.equal(top("office", { work: "together" }).id, "great-room");
  assert.equal(top("shop", { display: "showcase" }).id, "hall-street");
  assert.equal(top("shop", { display: "browse" }).id, "great-room");
  // A home's answers about a café's service are ignored: running only counts for businesses.
  assert.equal(rank({ space_type: "house", interview: { running: { service: "takeaway" } } })[0].why.length, 0);
});

test("the plans do what their reasons say", () => {
  const plan = (t: "cafe" | "office" | "shop", running: object) => {
    const p = templateFor(t, 1);
    return planOptionsFor(p, buildingShell(p, DEFAULT_SHELLS[t]), { space_type: t, interview: { running } })[0];
  };
  const onStreet = (l: ReturnType<typeof plan>, kind: string) => l.floors[0].spaces.some((s) => s.kind === kind && s.rect.y < 0.01);
  assert.ok(onStreet(plan("cafe", { service: "takeaway" }), "counter"), "takeaway: the counter is on the street");
  assert.ok(onStreet(plan("shop", { display: "showcase" }), "retail"), "showcase: the shop floor is on the street");
  const visitors = plan("office", { visitors: true });
  assert.equal(visitors.concept!.id, "hall-street");
  assert.ok(onStreet(visitors, "reception") && onStreet(visitors, "meeting"), "visitors: reception and meeting room by the street");
  // Focus work: desks and focus room in wings on either side of reception and the meeting room.
  const focus = plan("office", { work: "focus" }).floors[0].spaces;
  const at = (kind: string) => focus.find((s) => s.kind === kind)!.rect;
  const [desk, quiet, rec] = [at("workspace"), at("office"), at("reception")];
  const left = (a: typeof rec, b: typeof rec) => a.x + a.w <= b.x + 0.01;
  assert.ok((left(desk, rec) && left(rec, quiet)) || (left(quiet, rec) && left(rec, desk)));
  // A café's big seating area is never squeezed into the shallow row.
  for (const id of ["great-room", "split"]) {
    const p = templateFor("cafe", 1);
    const l = planOptionsFor(p, buildingShell(p, DEFAULT_SHELLS.cafe), { space_type: "cafe" }).find((o) => o.concept!.id === id)!;
    const seat = l.floors[0].spaces.find((s) => s.kind === "dining")!.rect;
    const counter = l.floors[0].spaces.find((s) => s.kind === "counter")!.rect;
    assert.ok(seat.w * seat.h > counter.w * counter.h, `${id}: seating bigger than the counter`);
  }
});
