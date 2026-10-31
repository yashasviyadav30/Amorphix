import { test } from "node:test";
import assert from "node:assert/strict";
import { MockLanguageModelV4 } from "ai/test";
import { allowedSources, Brief, briefPrompt, generateBrief, keepHonest, keepStyle } from "./brief.ts";
import type { Project } from "../project/store.ts";

const project: Project = {
  id: "p", owner_id: null, guest_id: null, mode: "owner", space_type: "house", title: "Test", status: "designing",
  site: { width: 12, depth: 18, floors: 2, location: "Austin, TX" },
  interview: { people: { adults: 2, kids: 2 } },
  taste_signals: [
    { entityId: "a", name: "Ace Hotel New York", layer: 1 },
    { entityId: "b", name: "The Grand Budapest Hotel", layer: 3 },
  ],
  taste: {
    tags: [{ family: "decor", value: "vintage", weight: 3, sources: [{ entityId: "a", name: "Ace Hotel New York", layer: 1 }] }],
    brands: [{ id: "x", name: "Pottery Barn", affinity: 0.8, aesthetic: ["warm_textures"], because: [] }],
  },
  brief: null, program: null, chosen_option: null,
};

const brief: Brief = {
  name: "Warm Vintage",
  summary: "Moody and warm.",
  palette: [
    { name: "Clay", hex: "#B5653F", role: "accent", from: ["Ace Hotel New York", "Made Up Café"] },
    { name: "Linen", hex: "#f2ece1", role: "base", from: [] },
    { name: "Oak", hex: "#8a5a3b", role: "wood", from: ["pottery barn"] },
    { name: "Fern", hex: "#4f7a4a", role: "green", from: [] },
  ],
  materials: [
    { name: "Smoked oak", where: "floors", from: ["The Grand Budapest Hotel"] },
    { name: "Brass", where: "lights", from: ["Somewhere Invented"] },
    { name: "Linen", where: "curtains", from: [] },
  ],
  lighting: { mood: "low and warm", fixtures: ["brass wall lights"], from: ["Ace Hotel New York"] },
  plants: [{ name: "Fiddle-leaf fig", where: "living room", why: "height" }, { name: "Pothos", where: "shelves", why: "easy" }],
};

test("only loved things and matched brands may be credited", () => {
  assert.deepEqual(allowedSources(project).sort(), ["Ace Hotel New York", "Pottery Barn", "The Grand Budapest Hotel"]);
});

test("invented credits are removed, real ones kept (any case), hex lowercased", () => {
  const b = keepHonest(brief, allowedSources(project));
  assert.deepEqual(b.palette[0].from, ["Ace Hotel New York"]);
  assert.equal(b.palette[0].hex, "#b5653f");
  assert.deepEqual(b.palette[2].from, ["pottery barn"]);
  assert.deepEqual(b.materials[1].from, []);
  assert.deepEqual(b.lighting.from, ["Ace Hotel New York"]);
});

test("the prompt carries the site, the taste and the rules", () => {
  const prompt = briefPrompt(project);
  for (const s of ["a house in Austin, TX, 2 floor(s)", 'decor "vintage"', "Pottery Barn", "Ace Hotel New York", "living plants", "# Voice"])
    assert.ok(prompt.includes(s), `prompt mentions ${s}`);
});

test("a model reply is parsed, validated and cleaned", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(brief) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
      warnings: [],
    }),
  });
  const b = await generateBrief(project, model);
  assert.equal(b.name, "Warm Classic", "the model's name keeps the style shown at the reveal");
  assert.deepEqual(b.materials[1].from, []);
});

test("a reply that breaks the schema is rejected", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify({ ...brief, palette: [{ name: "x", hex: "red", role: "base", from: [] }] }) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
      warnings: [],
    }),
  });
  await assert.rejects(generateBrief(project, model));
});

test("the style name keeps the style shown at the reveal", () => {
  assert.equal(keepStyle("Eclectic Industrial", "Modern"), "Eclectic Modern");
  assert.equal(keepStyle("Warm Modern Minimal", "Modern"), "Warm Modern Minimal");
  assert.equal(keepStyle("Modernist", "Modern"), "Modernist");
  assert.equal(keepStyle("", "Classic"), "Classic");
});
