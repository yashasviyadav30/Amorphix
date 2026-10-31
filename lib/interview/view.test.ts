import { test } from "node:test";
import assert from "node:assert/strict";
import { activity, finishedProject, latestTaste, speakable, textOf, type Msg } from "./view.ts";

const tool = (toolName: string, output: unknown, state = "output-available") => ({ type: "dynamic-tool", toolName, state, output });
const msg = (id: string, ...parts: object[]): Msg => ({ id, role: "assistant", parts: parts as Msg["parts"] });

test("the newest taste profile wins", () => {
  const messages = [
    msg("1", tool("add_taste", { tasteCount: 1, style: [{ word: "vintage", from: ["A"] }], brands: [] })),
    msg("2", tool("add_taste", { tasteCount: 2, style: [{ word: "warm", from: ["B"] }], brands: [{ name: "X", look: ["oak"] }] })),
  ];
  assert.deepEqual(latestTaste(messages), { count: 2, style: [{ word: "warm", from: ["B"] }], brands: [{ name: "X", look: ["oak"] }] });
});

test("unfinished tool calls and other tools are ignored", () => {
  assert.equal(latestTaste([msg("1", tool("add_taste", undefined, "input-available"), tool("find_taste", { results: [] }))]), null);
  assert.equal(latestTaste([]), null);
});

test("the project id appears only once finishing succeeds", () => {
  assert.equal(finishedProject([msg("1", tool("finish_interview", { ready: false, stillNeed: ["x"] }))]), null);
  assert.equal(finishedProject([msg("1", tool("finish_interview", { ready: true, projectId: "p1" }))]), "p1");
});

test("text parts join into one message", () => {
  assert.equal(textOf(msg("1", { type: "text", text: " Hello. " }, tool("x", {}), { type: "text", text: "Which city?" })), "Hello.\n\nWhich city?");
});

test("speakable text drops markdown and keeps link words", () => {
  assert.equal(speakable("**Warm oak**, see [the plan](https://x.y).\n\n- low lamps"), "Warm oak, see the plan. low lamps");
});

test("activity shows labels and which calls are still running", () => {
  const m = msg("1",
    { type: "dynamic-tool", toolName: "find_taste", state: "input-available", toolMetadata: { eve: { label: "Looking up Ace Hotel" } } },
    tool("set_project", { saved: true }),
  );
  assert.deepEqual(activity(m), [
    { label: "Looking up Ace Hotel", working: true },
    { label: "Saving the project details", working: false },
  ]);
});

test("a tool without a label shows what it is doing, never its code name", () => {
  const m = { id: "a", role: "assistant", parts: [{ type: "dynamic-tool", toolName: "set_project", state: "output-available" }, { type: "dynamic-tool", toolName: "mystery_tool", state: "output-available" }] } as unknown as Parameters<typeof activity>[0];
  assert.deepEqual(activity(m).map((a) => a.label), ["Saving the project details", "Working"]);
});

test("the progress rail fills stage by stage as the interviewer records each part", async () => {
  const { stageReached } = await import("./view.ts");
  assert.equal(stageReached([]), 0);
  assert.equal(stageReached([msg("1", tool("set_project", { saved: true }))]), 1);
  assert.equal(stageReached([msg("1", tool("set_project", {}), tool("save_answers", {}), tool("save_running", {}))]), 3);
  assert.equal(stageReached([msg("1", tool("save_answers", {}))]), 0, "a later stage can't jump the queue");
  assert.equal(stageReached([msg("1", tool("set_project", {}), tool("save_answers", {}), tool("save_living", {}), tool("add_taste", { tasteCount: 2 }))]), 3);
  assert.equal(stageReached([msg("1", tool("set_project", {}), tool("save_answers", {}), tool("save_living", {}), tool("add_taste", { tasteCount: 3 }))]), 4);
});

test("languages: greeting, listening and voice per language; Devanagari always reads in Hindi", async () => {
  const { langOf, voiceFor } = await import("./lang.ts");
  assert.match(langOf("hi").greeting, /नमस्ते/);
  assert.equal(langOf("nonsense").id, "en");
  assert.equal(voiceFor("घर", "en"), "hi-IN");
  assert.equal(voiceFor("Aap kya design karna chahte ho?", "hinglish"), "hi-IN");
  assert.equal(voiceFor("What are we designing?", "en"), "en");
});

test("tappable answers come from Amorphix's latest question, and go once the user replies", async () => {
  const { pendingChoices, joinPicks, activity } = await import("./view.ts");
  const ask = (input: unknown) => ({ id: "a", role: "assistant" as const, parts: [{ type: "dynamic-tool", toolName: "offer_choices", state: "input-available", input }, { type: "text", text: "New build or renovation?" }] });
  assert.deepEqual(pendingChoices([ask({ choices: ["New build", "Renovation"] })]), { choices: ["New build", "Renovation"], multi: false, hint: null });
  assert.deepEqual(pendingChoices([ask({ choices: [], hint: "e.g. Pune" })]), { choices: [], multi: false, hint: "e.g. Pune" });
  assert.equal(pendingChoices([ask({ choices: ["A"] }), { id: "u", role: "user", parts: [{ type: "text", text: "A" }] }]), null);
  assert.equal(pendingChoices([ask({ choices: [] })]), null, "nothing to show");
  assert.equal(pendingChoices([ask({ choices: [42, " ", "Yes"] })])!.choices.length, 1, "junk is dropped");
  assert.equal(activity(ask({ choices: ["x"] })).length, 0, "no activity line for suggestions");
  assert.equal(joinPicks(["Me", "My partner", "A dog"]), "Me, My partner and A dog");
  assert.equal(joinPicks(["Me"]), "Me");
});
