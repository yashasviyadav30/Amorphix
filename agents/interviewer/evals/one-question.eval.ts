import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { questionCount } from "../../../lib/voice.ts";
import { quietTools } from "./fixtures.ts";

export default defineEval({
  description: "The interviewer asks one question at a time.",
  async test(t) {
    const session = await t.session({ stubs: quietTools });
    await session.send("Hi, I want to design a café in Brooklyn.");
    t.succeeded();
    t.judge("The reply asks exactly one question, not a list of questions.").atLeast(0.7);
  },
});
