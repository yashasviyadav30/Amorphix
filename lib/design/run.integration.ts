// Integration test: the design pipeline against the real database, with a scripted model (no model quota).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { MockLanguageModelV4 } from "ai/test";
import { chooseOption, designProject } from "./run.ts";
import { createProject, deleteProject, latestVersion } from "../project/store.ts";

const brief = {
  name: "Quiet Oak",
  summary: "Calm and warm.",
  palette: [
    { name: "Linen", hex: "#f2ece1", role: "base", from: [] },
    { name: "Oak", hex: "#8a5a3b", role: "wood", from: [] },
    { name: "Clay", hex: "#b5653f", role: "accent", from: [] },
    { name: "Fern", hex: "#4f7a4a", role: "green", from: [] },
  ],
  materials: [
    { name: "Oak", where: "floors", from: [] },
    { name: "Linen", where: "curtains", from: [] },
    { name: "Brass", where: "lights", from: [] },
  ],
  lighting: { mood: "warm", fixtures: ["wall lights"], from: [] },
  plants: [{ name: "Pothos", where: "shelves", why: "easy" }, { name: "Fig", where: "living", why: "height" }],
};
let calls = 0;
const model = new MockLanguageModelV4({
  doGenerate: async () => {
    calls++;
    // First call writes the brief; the second returns a broken program so the template is used.
    const text = calls === 1 ? JSON.stringify(brief) : "not json";
    return {
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
      warnings: [],
    };
  },
});

const p = await createProject({ space_type: "apartment", status: "designing", site: { width: 12, depth: 9, floors: 1, location: "Seattle" } });
after(() => deleteProject(p.id));

test("an unfinished interview can't be designed", async () => {
  const q = await createProject({ space_type: "house" });
  try {
    await assert.rejects(designProject(q.id, model), /isn't finished/);
  } finally {
    await deleteProject(q.id);
  }
});

test("design saves a brief, a program and three options", async () => {
  const d = await designProject(p.id, model);
  assert.equal((d.brief as { name: string }).name, "Quiet Oak");
  assert.equal(d.options?.length, 3);
  assert.equal(d.program?.spaceType, "apartment");
});

test("a second run reuses what exists and makes no model calls", async () => {
  const before = calls;
  await designProject(p.id, model);
  assert.equal(calls, before);
});

test("choosing a plan saves it as version 1 and marks the project ready", async () => {
  const d = await chooseOption(p.id, 2);
  assert.equal(d.chosen_option, 2);
  assert.equal(d.status, "ready");
  assert.equal((await latestVersion(p.id))?.version, 1);
  await assert.rejects(chooseOption(p.id, 5), /no plan option 6/);
});
