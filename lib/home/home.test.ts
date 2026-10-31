import { test } from "node:test";
import assert from "node:assert/strict";
import { sketchOf } from "./sketch.ts";
import { statusLine, waitsFor, type WaitInput } from "./waiting.ts";
import type { Layout } from "../layout/schema.ts";

const layout = {
  spaceType: "house",
  shell: { width: 12.04, depth: 9.96 },
  floors: [
    { level: 1, spaces: [{ id: "b", name: "Bedroom", kind: "bedroom", zone: "private", rect: { x: 0, y: 0, w: 4, h: 4 } }], openings: [] },
    {
      level: 0,
      spaces: [
        { id: "l", name: "Living room", kind: "living", zone: "public", rect: { x: 0, y: 0, w: 6.04, h: 5 } },
        { id: "c", name: "Corridor", kind: "corridor", zone: "circulation", rect: { x: 6, y: 0, w: 1.2, h: 9.96 } },
      ],
      openings: [],
    },
  ],
} as unknown as Layout;

test("a sketch is the ground floor, rounded, with corridors left unnamed", () => {
  const s = sketchOf(layout)!;
  assert.equal(s.w, 12);
  assert.equal(s.floors, 2);
  assert.deepEqual(s.rooms.map((r) => r.name), ["Living room", null]);
  assert.equal(s.rooms[0].w, 6);
  assert.equal(sketchOf(null), null);
});

const base: WaitInput = { id: "p1", name: "The LA house", role: "owner", mode: "owner", status: "designing", chosen: true, decides: true, changesAsked: false, unread: 0, late: 0, fees: [] };

test("a review to answer comes before messages", () => {
  const w = waitsFor([{ ...base, status: "review", unread: 3 }]);
  assert.deepEqual(w.map((x) => x.kind), ["review", "messages"]);
  assert.match(w[1].text, /3 new messages/);
});

test("money: the client pays a billed fee, the architect confirms a claimed one", () => {
  const fees = [{ label: "Design", status: "billed", amount: "$3,000" }, { label: "Approval", status: "claimed", amount: "$4,000" }];
  assert.deepEqual(waitsFor([{ ...base, role: "client", fees }]).map((x) => x.kind), ["pay"]);
  assert.deepEqual(waitsFor([{ ...base, role: "architect", mode: "pro", fees }]).map((x) => x.kind), ["confirm"]);
});

test("changes asked go to whoever designs, and a viewer is never asked for anything", () => {
  assert.deepEqual(waitsFor([{ ...base, role: "architect", mode: "pro", changesAsked: true }]).map((x) => x.kind), ["changes"]);
  assert.deepEqual(waitsFor([{ ...base, role: "client", mode: "pro", changesAsked: true }]), []);
  assert.deepEqual(waitsFor([{ ...base, role: "viewer", decides: false, status: "review", late: 2, chosen: false }]), []);
});

test("the builder hears about late work; an unchosen design asks for a plan", () => {
  assert.equal(waitsFor([{ ...base, role: "builder", late: 1 }])[0].text, "1 thing behind on The LA house");
  assert.equal(waitsFor([{ ...base, chosen: false }])[0].kind, "choose");
});

test("the status line counts projects by stage and what's waiting", () => {
  assert.equal(statusLine(["Design", "Design", "Building"], 1), "2 in design · 1 in building · 1 waiting on you");
  assert.equal(statusLine([], 0), "no projects yet");
});
