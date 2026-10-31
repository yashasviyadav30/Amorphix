import { defineEval } from "eve/evals";
import { quietTools } from "./fixtures.ts";

const savedRunning = { id: "save-running", tool: "save_running", outcome: { response: { saved: ["people", "work", "visitors"], stillNeed: null } } };

export default defineEval({
  description: "An office answer with a headcount, the way they work and visitors is saved in one go, with numbers as numbers.",
  async test(t) {
    const session = await t.session({ stubs: [savedRunning, ...quietTools] });
    const turn = await session.send(
      "We're a 12-person design studio office. People mostly need quiet to concentrate, and clients drop by for reviews twice a week.",
    );
    turn.expectOk();
    // The count may come as a number or only in their words; save_running keeps it either way (running.test.ts).
    turn.calledTool("save_running", { input: (i: any) => i.work === "focus" && i.visitors === true && (i.people === 12 || /12/.test(i.said?.people ?? "")) });
    t.notCalledTool("save_living");
    t.judge("The reply does not ask again how many people work there, whether the work is focused, or whether clients visit, and it asks at most one question.").atLeast(0.7);
  },
});
