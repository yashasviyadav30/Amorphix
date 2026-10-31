import { defineEval } from "eve/evals";
import { quietTools } from "./fixtures.ts";
import { sizeFrom } from "../../../lib/interview/logic.ts";

// What set_project saves: the numbers the model sent, or the ones in the size the user said (see sizeFrom).
const size = (i: { size?: string; width?: number; depth?: number }) => sizeFrom(i.size, i.width, i.depth);

export default defineEval({
  description: "Many facts in one message are all saved, and the agent doesn't ask for them again.",
  async test(t) {
    const session = await t.session({ stubs: quietTools });
    const turn = await session.send(
      "OK quick version: renovation of a single-storey apartment in Seattle, 40 by 30 feet. It's me and my partner, both work from home, we have a cat. We need two bedrooms and an office, and we hate our dark kitchen.",
    );
    turn.expectOk();
    turn.calledTool("set_project", {
      input: (i: any) => i.spaceType === "apartment" && size(i).width === 40 && size(i).depth === 30 && /seattle/i.test(i.location ?? ""),
    });
    turn.calledTool("save_answers", { count: (n: number) => n >= 1 });
    t.judge("The reply does not ask again for the city, size, who lives there, pets or rooms needed.").atLeast(0.7);
  },
});
