import { test } from "node:test";
import assert from "node:assert/strict";
import { MockLanguageModelV4 } from "ai/test";
import { fromModel, programOf, readPlan, type LooseRead } from "./read.ts";
import { snapPlan } from "./snap.ts";
import { planOptionsFor } from "../design/options.ts";
import { validate } from "../layout/validate.ts";

const raw: LooseRead = {
  width: 10, depth: 8, scaleFromDrawing: false,
  rooms: [
    { name: "Lounge", kind: "Living Room", floor: 0, x: 0, y: 0, w: 6, h: 3.4 },
    { name: "Kitchen", kind: "kitchen", floor: 0, x: 6, y: 0, w: 4, h: 3.4 },
    { name: "Master", kind: "Master Bedroom", floor: 0, x: 0, y: 4.6, w: 5, h: 3.4 },
    { name: "WC", kind: "W.C.", floor: 0, x: 5, y: 4.6, w: 2, h: 3.4 },
    { name: "Room 3", kind: "kids room", floor: 0, x: 7, y: 4.6, w: 3, h: 3.4 },
    { name: "Bad", kind: "living", floor: 0, x: Number.NaN, y: 0, w: 2, h: 2 },
  ],
  entry: null,
  questions: [" Is Room 3 a bedroom or a study? ", ""],
};

test("the user's size beats the drawing's, and unknown kinds map to known ones", () => {
  const { read, questions } = fromModel(raw, { spaceType: "apartment", width: 40, depth: 32, units: "imperial" });
  assert.ok(Math.abs(read.width - 40 * 0.3048) < 1e-9 && Math.abs(read.depth - 32 * 0.3048) < 1e-9);
  assert.deepEqual(read.rooms.map((r) => r.kind), ["living", "kitchen", "bedroom", "bath", "bedroom"]);
  assert.ok(Math.abs(read.rooms[1].x - 6 * 1.2192) < 1e-9, "scaled with the building");
  assert.deepEqual(questions, ["Is Room 3 a bedroom or a study?"]);
});

test("with no size and no scale on the drawing, Amorphix asks for one", () => {
  const { questions } = fromModel(raw, { spaceType: "house", units: "metric" });
  assert.match(questions[0], /How wide and how deep .* metres/);
});

test("a read plan snaps to a valid layout, and two other layouts of the same rooms fit beside it", () => {
  const { read } = fromModel(raw, { spaceType: "apartment", units: "metric" });
  const { layout, problems } = snapPlan(read);
  assert.deepEqual(problems, []);
  const program = programOf(layout);
  assert.equal(program.rooms.length, 5);
  const others = planOptionsFor(program, layout.shell, { space_type: "apartment" }).slice(0, 2);
  assert.equal(others.length, 2);
  for (const o of others) assert.deepEqual(validate(o), []);
});

test("readPlan sends the image to the model and cleans its answer", async () => {
  let sent: unknown;
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      sent = options.prompt;
      return { content: [{ type: "text", text: JSON.stringify(raw) }], finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }, warnings: [] };
    },
  });
  const { read } = await readPlan(new Uint8Array([137, 80, 78, 71]), "image/png", { spaceType: "apartment", units: "metric" }, model);
  assert.equal(read.rooms.length, 5);
  assert.match(JSON.stringify(sent), /image\/png/);
});

test("room names in capitals read as normal names", () => {
  const { read } = fromModel({ ...raw, rooms: [{ name: "LIVING AND  DINING", kind: "living", floor: 0, x: 0, y: 0, w: 5, h: 4 }, { name: "Bedroom 2", kind: "bedroom", floor: 0, x: 5, y: 0, w: 4, h: 4 }] }, { spaceType: "house", units: "metric" });
  assert.deepEqual(read.rooms.map((r) => r.name), ["Living and dining", "Bedroom 2"]);
});

test("an entrance drawn at the bottom turns the plan so the street side is the front", () => {
  const { read } = fromModel({ ...raw, rooms: raw.rooms.slice(0, 3), entry: { x: 3, y: 8 } }, { spaceType: "apartment", units: "metric" });
  assert.deepEqual(read.entry, { x: 3, y: 0 });
  // The living room was at the top (y 0 to 3.4); after turning it sits at the back.
  assert.ok(Math.abs(read.rooms[0].y - (8 - 3.4)) < 1e-9);
  assert.ok(Math.abs(read.rooms[2].y - 0) < 1e-9, "the bottom row is now the front");
});
