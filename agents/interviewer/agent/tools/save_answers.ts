import { defineTool } from "eve/tools";
import { z } from "zod";
import { saveInterview } from "../../../../lib/project/store.ts";
import { sessionProject } from "../lib/session.ts";

export default defineTool({
  description:
    "Save facts the user shared, grouped by section. Use short keys and plain values, for example {adults: 2, kids: [5, 9], pets: 'dog', worksFromHome: true}. Later answers in the same section merge with earlier ones.",
  inputSchema: z.object({
    section: z.enum(["people", "routines", "needs", "dislikes", "keep", "budget", "timeline", "guests", "other"]),
    facts: z.record(z.string(), z.unknown()),
  }),
  label: { start: ({ section }) => `Noting ${section}` },
  async execute({ section, facts }, ctx) {
    const p = await sessionProject(ctx);
    await saveInterview(p.id, section, facts);
    return { saved: Object.keys(facts) };
  },
});
