import { test } from "node:test";
import assert from "node:assert/strict";
import { MockLanguageModelV4 } from "ai/test";
import { fitNeeds, generateProgram, optionsFor, templateFor, toProgram } from "./program.ts";
import type { Project } from "../project/store.ts";

const reply = (body: unknown) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: typeof body === "string" ? body : JSON.stringify(body) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
      warnings: [],
    }),
  });

const project = (over: Partial<Project> = {}): Project => ({
  id: "p", owner_id: null, guest_id: null, mode: "owner", space_type: "apartment", title: null, status: "designing",
  site: { width: 12, depth: 9, floors: 1, location: "Seattle" }, interview: {}, taste_signals: [], taste: null,
  brief: null, program: null, chosen_option: null, ...over,
});

test("draft rooms get unique ids and floors that exist", () => {
  const p = toProgram("house", 1, [
    { name: "Bedroom", kind: "bedroom", area: 12, zone: "private", floor: 1 },
    { name: "Bedroom", kind: "bedroom", area: 12, zone: "private", floor: 0 },
    { name: "Kid's room!", kind: "bedroom", area: 10, zone: "private", floor: 0 },
  ]);
  assert.deepEqual(p.rooms.map((r) => r.id), ["bedroom", "bedroom-2", "kid-s-room"]);
  assert.ok(p.rooms.every((r) => r.floor === 0));
});

test("a one-floor template moves private rooms upstairs on a two-floor site", () => {
  const t = templateFor("apartment", 2);
  assert.equal(t.floors, 2);
  assert.ok(t.rooms.filter((r) => r.zone === "private").every((r) => r.floor === 1));
  assert.ok(templateFor("house", 1).rooms.every((r) => r.floor === 0));
});

test("an empty floor or an impossible shell gives no options", () => {
  const upstairsOnly = toProgram("house", 2, [{ name: "Bed", kind: "bedroom", area: 12, zone: "private", floor: 1 }]);
  assert.equal(optionsFor(upstairsOnly, { width: 12, depth: 10 }), null);
  assert.equal(optionsFor(templateFor("hotel", 1), { width: 8, depth: 10 }), null);
  assert.equal(optionsFor(templateFor("apartment", 1), { width: 12, depth: 9 })?.length, 3);
});

test("a good draft from the model is used", async () => {
  const draft = {
    rooms: [
      { name: "Living and dining", kind: "living", area: 30, zone: "public", floor: 0 },
      { name: "Kitchen", kind: "kitchen", area: 12, zone: "public", floor: 0 },
      { name: "Bedroom", kind: "bedroom", area: 14, zone: "private", floor: 0 },
      { name: "Office", kind: "office", area: 9, zone: "private", floor: 0 },
      { name: "Bath", kind: "bath", area: 5, zone: "service", floor: 0 },
    ],
  };
  const r = await generateProgram(project(), reply(draft));
  assert.equal(r.source, "model");
  assert.equal(r.options.length, 3);
  assert.ok(r.program.rooms.some((x) => x.id === "office"));
});

test("a broken or unplaceable draft falls back to the tested template", async () => {
  assert.equal((await generateProgram(project(), reply("not json"))).source, "template");
  const tooMany = { rooms: Array.from({ length: 20 }, (_, i) => ({ name: `Room ${i}`, kind: "bedroom", area: 10, zone: "private", floor: 0 })) };
  const r = await generateProgram(project(), reply(tooMany));
  assert.equal(r.source, "template");
  assert.equal(r.options.length, 3);
});

test("a site too small for the space type is refused clearly", async () => {
  await assert.rejects(generateProgram(project({ space_type: "hotel", site: { width: 8, depth: 10 } }), reply("x")), /doesn't fit/);
});

test("the draft schema has no integer types, which Gemini rejects", async () => {
  const { z } = await import("zod");
  const mod = await import("./program.ts");
  const json = JSON.stringify(z.toJSONSchema(z.object({ rooms: z.array(z.object({ floor: z.number().min(0).max(1) })) })));
  assert.ok(!json.includes("9007199254740991"));
  assert.equal(mod.toProgram("house", 2, [{ name: "A", kind: "bedroom", area: 10, zone: "private", floor: 0.6 }]).rooms[0].floor, 1);
});

test("a home's rooms match the answers: two bedrooms and a guest room, no study unless someone works from home", () => {
  const p = fitNeeds(templateFor("house", 2), { needs: { bedrooms: 2, rooms: ["guest"] }, people: { worksFromHome: false } });
  const kinds = (k: string) => p.rooms.filter((r) => r.kind === k);
  assert.equal(kinds("bedroom").length, 2);
  assert.deepEqual(kinds("guest-room").map((r) => r.name), ["Guest room"]);
  assert.equal(kinds("office").length, 0);
  assert.ok(kinds("bedroom").some((r) => r.name === "Primary bedroom"), "the biggest bedroom stays the primary");
  assert.equal(new Set(p.rooms.map((r) => r.id)).size, p.rooms.length);
  // more bedrooms than the template, an office for someone working from home
  const big = fitNeeds(templateFor("house", 2), { needs: { bedrooms: 5 }, people: { worksFromHome: true } });
  assert.equal(big.rooms.filter((r) => r.kind === "bedroom").length, 5);
  assert.equal(big.rooms.filter((r) => r.kind === "office").length, 1);
  assert.ok(optionsFor(p, { width: 14, depth: 12 }, {}, 1), "the fitted house still lays out");
  // a café is left alone
  assert.deepEqual(fitNeeds(templateFor("cafe", 1), { needs: { bedrooms: 2 } }), templateFor("cafe", 1));
});
