import { defineEval } from "eve/evals";
import { quietTools } from "./fixtures.ts";

export default defineEval({
  description: "The agent answers in the user's language.",
  async test(t) {
    const session = await t.session({ stubs: quietTools });
    await session.send("Mujhe Mumbai mein ek chhota cafe design karna hai, 30 by 25 feet ka.");
    t.succeeded();
    t.judge("The reply is written in Hinglish or Hindi, matching the user's language, not in plain English only.").atLeast(0.7);
  },
});
