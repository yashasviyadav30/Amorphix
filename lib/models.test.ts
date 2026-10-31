import { test } from "node:test";
import assert from "node:assert/strict";
import { route } from "./models.ts";

test("defaults to Gemini Flash", () => {
  assert.deepEqual(route({}), { via: "gateway", model: "google/gemini-3.5-flash" });
});

test("Gemini goes direct when its key is set", () => {
  assert.deepEqual(route({ GOOGLE_GENERATIVE_AI_API_KEY: "k" }), { via: "google", model: "gemini-3.5-flash" });
});

test("switching to Claude is one env var", () => {
  const env = { AMORPHIX_MODEL: "anthropic/claude-sonnet-5.5", GOOGLE_GENERATIVE_AI_API_KEY: "k" };
  assert.deepEqual(route(env), { via: "gateway", model: "anthropic/claude-sonnet-5.5" });
  assert.deepEqual(route({ ...env, ANTHROPIC_API_KEY: "a" }), { via: "anthropic", model: "claude-sonnet-5.5" });
});

test("any other provider routes through the gateway", () => {
  assert.deepEqual(route({ AMORPHIX_MODEL: "openai/gpt-6" }), { via: "gateway", model: "openai/gpt-6" });
});

test("out of quota, the next model answers; a real error is not hidden", async () => {
  const { withFallback, isQuota } = await import("./models.ts");
  const { generateText } = await import("ai");
  const { MockLanguageModelV4 } = await import("ai/test");
  const quota = Object.assign(new Error("You exceeded your current quota"), { statusCode: 429 });
  const answer = (text: string) =>
    new MockLanguageModelV4({
      doGenerate: async () => ({ content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }, warnings: [] }),
    });
  const failing = (err: Error) => new MockLanguageModelV4({ doGenerate: async () => { throw err; } });
  const r = await generateText({ model: withFallback(failing(quota), [failing(quota), answer("from the third")]), prompt: "hi", maxRetries: 0 });
  assert.equal(r.text, "from the third");
  await assert.rejects(generateText({ model: withFallback(failing(new Error("bad request")), [answer("never")]), prompt: "hi", maxRetries: 0 }), /bad request/);
  assert.ok(isQuota(quota) && isQuota(new Error("RESOURCE_EXHAUSTED")) && !isQuota(new Error("invalid key")));
  assert.ok(isQuota(new Error("This model is currently experiencing high demand")) && isQuota(Object.assign(new Error("x"), { statusCode: 503 })));
});

test("an agent that calls tools never leads with a lite model", async () => {
  const { geminiOrder } = await import("./models.ts");
  assert.deepEqual(geminiOrder("gemini-3.1-flash-lite", true, ["gemini-3.5-flash", "gemini-3.1-flash-lite"]), ["gemini-3.5-flash", "gemini-3.1-flash-lite"]);
  assert.deepEqual(geminiOrder("gemini-3.1-flash-lite", false, ["gemini-3.5-flash"]), ["gemini-3.1-flash-lite", "gemini-3.5-flash"]);
  assert.deepEqual(geminiOrder("gemini-3.5-flash", true, ["gemini-3.5-flash", "gemini-2.5-flash"]), ["gemini-3.5-flash", "gemini-2.5-flash"]);
});
