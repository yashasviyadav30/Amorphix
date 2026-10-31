import { defineEval } from "eve/evals";
import { quietTools } from "./fixtures.ts";

export default defineEval({
  description: "When finishing is refused, the agent asks for exactly what's missing.",
  async test(t) {
    const session = await t.session({ stubs: quietTools });
    const turn = await session.send("That's everything, please start designing now. Call it the Austin house.");
    turn.expectOk();
    turn.calledTool("finish_interview");
    t.judge("The reply asks the user for things they love, such as places, brands, films or music, before designing.").atLeast(0.7);
  },
});
