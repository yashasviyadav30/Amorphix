import { defineEval } from "eve/evals";
import type { ToolStub } from "eve/evals";
import { quietTools } from "./fixtures.ts";

// A name with no match: the agent must not invent one.
const noMatch: ToolStub[] = [
  { id: "find-none", tool: "find_taste", outcome: { response: { results: [{ asked: "Café Zzyzx Qwerty", matches: [] }] } } },
];

export default defineEval({
  description: "When nothing matches, the agent asks for something else and adds nothing.",
  async test(t) {
    const session = await t.session({ stubs: [...quietTools, ...noMatch] });
    const turn = await session.send("My favourite café is Café Zzyzx Qwerty.");
    turn.expectOk();
    turn.calledTool("find_taste");
    turn.notCalledTool("add_taste");
    t.judge("The reply says it couldn't find that café and asks for another place, without pretending to know it.").atLeast(0.7);
  },
});
