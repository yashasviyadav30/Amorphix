import { test } from "node:test";
import assert from "node:assert/strict";
import { applyChange, describe, type Change } from "./edit.ts";
import { placeConcept } from "../layout/concepts.ts";
import { TEMPLATES, DEFAULT_SHELLS } from "../layout/templates.ts";
import { buildingShell } from "../layout/footprint.ts";
import { validate } from "../layout/validate.ts";
import type { Layout } from "../layout/schema.ts";

function plan(type: "house" | "apartment" | "cafe" = "apartment", concept: "great-room" | "hall-street" = "great-room"): Layout {
  const program = TEMPLATES[type];
  const l = placeConcept(program, buildingShell(program, DEFAULT_SHELLS[type]), concept);
  assert.ok(l, `${type} ${concept} should fit`);
  return { ...l, concept: { id: concept, name: "Open great room", why: ["because"] } };
}
const rooms = (l: Layout) => l.floors.flatMap((f) => f.spaces).filter((s) => s.zone !== "circulation");
const area = (l: Layout, id: string) => {
  const s = rooms(l).find((r) => r.id === id)!;
  return s.rect.w * s.rect.h;
};
const ok = (r: ReturnType<typeof applyChange>) => {
  assert.ok("layout" in r, "error" in r ? r.error : "");
  assert.deepEqual(validate(r.layout).filter((m) => !m.startsWith("warn")), [], "the edited plan passes the validator");
  return r.layout;
};

test("bigger and smaller change the room and keep the plan valid", () => {
  const l = plan("apartment", "hall-street");
  const kitchen = rooms(l).find((r) => r.kind === "kitchen")!.id;
  const bigger = ok(applyChange(l, { op: "resize", room: kitchen, by: 1.25 }));
  assert.ok(area(bigger, kitchen) > area(l, kitchen) * 1.03, "the kitchen grew");
  const smaller = ok(applyChange(l, { op: "resize", room: kitchen, by: 0.8 }));
  assert.ok(area(smaller, kitchen) < area(l, kitchen) * 0.97, "the kitchen shrank");
  // The concept and its reasons stay with the plan.
  assert.equal(bigger.concept?.id, "hall-street");
  assert.equal(bigger.concept?.name, "Open great room");
});

test("every resize in every layout either moves the room the right way or says why", () => {
  for (const type of ["house", "apartment", "cafe"] as const)
    for (const concept of ["great-room", "hall-street"] as const) {
      const l = plan(type, concept);
      for (const r of rooms(l))
        for (const by of [1.25, 0.8]) {
          const out = applyChange(l, { op: "resize", room: r.id, by });
          if ("error" in out) {
            assert.match(out.error, /can't get (bigger|smaller)/);
            continue;
          }
          const ratio = area(ok(out), r.id) / area(l, r.id);
          assert.ok(by > 1 ? ratio >= 1.04 : ratio <= 0.96, `${type} ${concept} ${r.id} x${by}: ${ratio.toFixed(2)}`);
        }
    }
});

test("adding and removing rooms", () => {
  const l = plan("house", "hall-street");
  const added = ok(applyChange(l, { op: "add", kind: "office", name: "Study" }));
  const study = rooms(added).filter((r) => r.kind === "office");
  assert.equal(study.length, rooms(l).filter((r) => r.kind === "office").length + 1);
  const bed = rooms(l).find((r) => r.kind === "bedroom")!.id;
  const removed = ok(applyChange(l, { op: "remove", room: bed }));
  assert.equal(rooms(removed).some((r) => r.id === bed), false);
});

test("the only kitchen or bathroom can't be removed", () => {
  const l = plan();
  const kitchen = rooms(l).find((r) => r.kind === "kitchen")!.id;
  const r = applyChange(l, { op: "remove", room: kitchen });
  assert.ok("error" in r && /only kitchen/.test(r.error));
});

test("rename keeps the geometry", () => {
  const l = plan();
  const id = rooms(l)[0].id;
  const renamed = ok(applyChange(l, { op: "rename", room: id, name: "  Reading nook " }));
  assert.equal(rooms(renamed).find((r) => r.id === id)!.name, "Reading nook");
  assert.deepEqual(rooms(renamed).map((r) => r.rect), rooms(l).map((r) => r.rect));
});

test("the kitchen opens and closes", () => {
  const l = plan();
  const closed = ok(applyChange(l, { op: "kitchen", open: false }));
  assert.equal(rooms(closed).find((r) => r.kind === "kitchen")!.open, false);
  const again = applyChange(closed, { op: "kitchen", open: false });
  assert.ok("error" in again);
  const opened = ok(applyChange(closed, { op: "kitchen", open: true }));
  assert.notEqual(rooms(opened).find((r) => r.kind === "kitchen")!.open, false);
});

test("too much for the plot says so plainly", () => {
  let l = plan("cafe");
  let last: ReturnType<typeof applyChange> = { layout: l };
  for (let i = 0; i < 12 && "layout" in last; i++) {
    l = last.layout;
    last = applyChange(l, { op: "add", kind: "meeting", name: "Meeting room" });
  }
  assert.ok("error" in last && /isn't room/.test(last.error));
});

test("an uploaded plan can only be renamed", () => {
  const l = { ...plan(), concept: { id: "own", name: "Your plan", why: [] } };
  const id = rooms(l)[0].id;
  assert.ok("error" in applyChange(l, { op: "resize", room: id, by: 1.25 }));
  assert.ok("layout" in applyChange(l, { op: "rename", room: id, name: "Den" }));
});

test("changes read in plain words", () => {
  const l = plan();
  const kitchen = rooms(l).find((r) => r.kind === "kitchen")!;
  const say = (c: Change) => describe(c, l);
  assert.equal(say({ op: "resize", room: kitchen.id, by: 1.25 }), `Made the ${kitchen.name} bigger`);
  assert.equal(say({ op: "add", kind: "office", name: "Study" }), "Added a study");
  assert.equal(say({ op: "kitchen", open: true }), "Opened the kitchen to the living area");
});

test("a rename can't make two rooms with the same name", () => {
  const l = plan();
  const [a, b] = rooms(l);
  const r = applyChange(l, { op: "rename", room: b.id, name: a.name.toLowerCase() });
  assert.ok("error" in r && /already a room/.test(r.error));
});

test("a room that doesn't fit as the plan stands takes a little space from the others", () => {
  // fill the plan until a study only fits by easing the rest, then check every room still passes the rules
  let l = plan();
  let squeezed = false;
  for (let i = 0; i < 8 && !squeezed; i++) {
    const r = applyChange(l, { op: "add", kind: "office", name: "Study" });
    if ("error" in r) break;
    const before = rooms(l).reduce((n, s) => n + s.rect.w * s.rect.h, 0);
    const after = rooms(r.layout).filter((s) => rooms(l).some((o) => o.id === s.id)).reduce((n, s) => n + s.rect.w * s.rect.h, 0);
    squeezed = after < before * 0.97;
    l = ok(r);
  }
  assert.ok(squeezed, "some add eased the other rooms instead of refusing");
});

test("a full building lets a room grow into the garden, never past the plot", () => {
  const l = plan("house", "great-room");
  const kitchen = rooms(l).find((r) => r.kind === "kitchen")!.id;
  const lot = DEFAULT_SHELLS.house;
  const r = ok(applyChange(l, { op: "resize", room: kitchen, by: 1.25 }, lot));
  assert.ok(area(r, kitchen) > area(l, kitchen) * 1.03);
  assert.ok(r.shell.width <= lot.width && r.shell.depth <= lot.depth);
  // smaller never grows the building
  const s = applyChange(l, { op: "resize", room: kitchen, by: 0.8 }, lot);
  if ("layout" in s) assert.deepEqual([s.layout.shell.width, s.layout.shell.depth], [l.shell.width, l.shell.depth]);
});
