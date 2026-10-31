import { defineEval } from "eve/evals";
import { quietTools } from "./fixtures.ts";

export default defineEval({
  description: "Questions come with answers to tap; a question only the user can answer comes with an example instead.",
  async test(t) {
    const session = await t.session({ stubs: quietTools });
    const first = await session.send("A home.");
    first.expectOk();
    // New build or renovation, floors, and the like have obvious answers to tap.
    first.calledTool("offer_choices", { input: (i: { choices?: string[]; hint?: string }) => (i.choices?.length ?? 0) >= 2 || !!i.hint });
    t.judge("The reply asks one short question and does not list the answer options in the text.").atLeast(0.7);
  },
});
