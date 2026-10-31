import { defineEval } from "eve/evals";
import { quietTools } from "./fixtures.ts";

export default defineEval({
  description: "A café owner isn't asked home questions: no bedrooms or cooking-at-home talk, and how-you-live isn't saved.",
  async test(t) {
    const session = await t.session({ stubs: quietTools });
    const turn = await session.send("We're opening a small café in Portland, about 30 by 50 feet, mostly students and remote workers come in.");
    turn.expectOk();
    t.notCalledTool("save_living");
    t.judge("The reply asks one question about the café or its customers, and does not ask about bedrooms, family or how they cook at home.").atLeast(0.7);
  },
});
