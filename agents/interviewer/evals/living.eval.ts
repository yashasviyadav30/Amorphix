import { defineEval } from "eve/evals";
import { quietTools } from "./fixtures.ts";

const savedLiving = { id: "save-living", tool: "save_living", outcome: { response: { saved: ["kitchen"], stillNeed: "how they live: whether the bedrooms should be close together or the main bedroom apart" } } };

export default defineEval({
  description: "A home owner's answer about cooking is saved as how they live, in their own words, and the next question is about bedrooms.",
  async test(t) {
    const session = await t.session({ stubs: [savedLiving, ...quietTools] });
    const turn = await session.send(
      "It's a house for me, my husband and our two kids. I really want to cook while I keep an eye on the kids doing homework, I hate being shut away in a kitchen.",
    );
    turn.expectOk();
    turn.calledTool("save_living");
    // Project basics (new build or renovation, size) may come first; what matters is one question, and not asking about the kitchen again.
    t.judge("The reply asks exactly one question, and does not ask again how they want the kitchen (open or closed), since they already said.").atLeast(0.7);
  },
});
