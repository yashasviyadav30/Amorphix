import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { defineEvalConfig } from "eve/evals";

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });

export default defineEvalConfig({
  timeoutMs: 180_000,
  // The free Gemini tier allows only a few requests a minute, so evals run one at a time and the judge uses
  // Flash-Lite, whose quota is separate from the agent's (a Flash judge used up the app's daily quota).
  // Flash-Lite sometimes scores a correct reply 0: read the reply before trusting a judge failure.
  maxConcurrency: 1,
  judge: { model: google.decisionModel("gemini-3.1-flash-lite") },
});
