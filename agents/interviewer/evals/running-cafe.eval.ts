import { defineEval } from "eve/evals";
import { quietTools } from "./fixtures.ts";

const savedRunning = {
  id: "save-running",
  tool: "save_running",
  outcome: { response: { saved: ["service"], stillNeed: "how they run it: whether they cook full meals or only make coffee and light food" } },
};

export default defineEval({
  description: "A café owner's answer about takeaway is saved as how they run it, in their own words, and the next question is about the kitchen.",
  async test(t) {
    const session = await t.session({ stubs: [savedRunning, ...quietTools] });
    const turn = await session.send(
      "It's a small café in Pune, 30 by 50 feet. Most of our customers are college students who grab a coffee to go between classes.",
    );
    turn.expectOk();
    turn.calledTool("save_running", { input: { service: "takeaway" } });
    t.notCalledTool("save_living");
    t.judge("The reply asks exactly one question, and it is about whether they cook full meals or only make coffee and light food (or what the kitchen needs to do).").atLeast(0.7);
  },
});
