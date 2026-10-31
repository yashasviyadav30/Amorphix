import { defineEval } from "eve/evals";
import { quietTools } from "./fixtures.ts";
import { sizeFrom } from "../../../lib/interview/logic.ts";

// What set_project saves: the numbers the model sent, or the ones in the size the user said (see sizeFrom).
const size = (i: { size?: string; width?: number; depth?: number }) => sizeFrom(i.size, i.width, i.depth);

export default defineEval({
  description: "Sizes given in metres are saved in metres.",
  async test(t) {
    const session = await t.session({ stubs: quietTools });
    const turn = await session.send("I'm designing a small studio in Berlin, the floor is 11 by 8 metres.");
    turn.expectOk();
    turn.calledTool("set_project", { input: (i: any) => i.spaceType === "studio" && size(i).width === 11 && size(i).depth === 8 && (size(i).unit ?? i.unit) === "m" });
  },
});
