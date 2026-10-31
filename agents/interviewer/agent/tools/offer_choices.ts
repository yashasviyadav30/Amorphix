import { defineTool } from "eve/tools";
import { z } from "zod";

// Tappable answers for the question just asked, so people pick instead of type. The page shows them as chips
// under the question; nothing is saved here, the user's pick comes back as their next message.
export default defineTool({
  description:
    "Show tappable answers for the question you are asking, in the user's language. Call it with every question that has likely answers: 2 to 6 short choices, 1 to 4 words each. Set multi to true when several can apply (who lives there, rooms they need). For questions only the user can answer (their city, the plot size, a place or film they love), give no choices and put an example in hint instead, like 'e.g. 30 by 40 ft' or 'e.g. Ace Hotel New York'.",
  inputSchema: z.object({
    choices: z.array(z.string()).describe("short answers to tap, in the user's language; empty when only typing makes sense"),
    multi: z.boolean().optional().describe("true when the user may pick several"),
    hint: z.string().optional().describe("an example answer shown in the typing box, when typing is needed"),
  }),
  label: { start: () => "Suggesting answers" },
  async execute({ choices }) {
    return { shown: choices.length };
  },
});
