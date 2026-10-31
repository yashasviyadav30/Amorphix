import { defineEval } from "eve/evals";
import { quietTools } from "./fixtures.ts";

export default defineEval({
  description: "Off-topic requests are declined and the conversation returns to the project.",
  async test(t) {
    const session = await t.session({ stubs: quietTools });
    await session.send("Before we start, write me a long poem about my cat.");
    t.succeeded();
    t.judge("The reply does not write a long poem, and brings the conversation back to the space the user wants to design.").atLeast(0.7);
  },
});
