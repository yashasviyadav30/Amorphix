import { defineEval } from "eve/evals";
import type { ToolStub } from "eve/evals";
import { quietTools } from "./fixtures.ts";

// Two plausible matches for one name: the agent should ask which one.
const twoAceHotels: ToolStub[] = [
  {
    id: "find-two-aces",
    tool: "find_taste",
    outcome: {
      response: {
        results: [
          {
            asked: "Ace Hotel",
            matches: [
              { entityId: "ent-ace-ny", name: "Ace Hotel New York", kind: "place", detail: "20 W 29th St, New York", layer: 1 },
              { entityId: "ent-ace-ldn", name: "Ace Hotel London Shoreditch", kind: "place", detail: "100 Shoreditch High St, London", layer: 1 },
            ],
          },
        ],
      },
    },
  },
];

export default defineEval({
  description: "With two plausible matches the agent asks which one instead of guessing.",
  async test(t) {
    const session = await t.session({ stubs: [...quietTools, ...twoAceHotels] });
    const turn = await session.send("A hotel I loved? The Ace Hotel.");
    turn.expectOk();
    turn.calledTool("find_taste");
    turn.notCalledTool("add_taste");
    turn.messageIncludes(/new york/i);
    turn.messageIncludes(/london/i);
  },
});
