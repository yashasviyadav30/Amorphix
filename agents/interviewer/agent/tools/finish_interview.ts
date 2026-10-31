import { defineTool } from "eve/tools";
import { z } from "zod";
import { getProject, updateProject } from "../../../../lib/project/store.ts";
import { missingForDesign } from "../../../../lib/interview/logic.ts";
import { sessionProject } from "../lib/session.ts";

export default defineTool({
  description:
    "Finish the interview and start the design. Call it once you have the space type, site size, location, budget and enough taste. If something is still missing it tells you what to ask for instead.",
  inputSchema: z.object({ title: z.string().describe("a short project name, e.g. 'The Austin house' or 'Brooklyn boutique hotel'") }),
  label: { start: () => "Starting your design" },
  async execute({ title }, ctx) {
    const p = await getProject((await sessionProject(ctx)).id);
    const missing = missingForDesign(p);
    if (missing.length) return { ready: false, stillNeed: missing };
    await updateProject(p.id, { status: "designing", title });
    return { ready: true, projectId: p.id };
  },
  endsTurn: (out) => out.ready,
});
