import { defineEval } from "eve/evals";
import { aceHotelTaste, quietTools } from "./fixtures.ts";

export default defineEval({
  description: "A loved place is looked up, added, and reflected back as style in plain words.",
  async test(t) {
    const session = await t.session({ stubs: [...quietTools, ...aceHotelTaste] });
    const turn = await session.send("A hotel I never wanted to leave? The Ace Hotel in New York, easily.");
    turn.expectOk();
    turn.toolOrder(["find_taste", "add_taste"]);
    turn.calledTool("add_taste", { input: { entityIds: ["ent-ace"] } });
    turn.messageIncludes(/vintage|moody|industrial/i);
  },
});
