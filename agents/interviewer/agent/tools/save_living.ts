import { defineTool } from "eve/tools";
import { getProject, updateProject } from "../../../../lib/project/store.ts";
import { Living, livingMissing, livingOf, mergeLiving } from "../../../../lib/interview/living.ts";
import { sessionProject } from "../lib/session.ts";

export default defineTool({
  description:
    "Save how the household lives in their home: kitchen open or closed, how often they have people over, overnight guests, bedrooms together or apart, clients visiting the home office, and whether the living room faces the garden or the street. Put the user's own few words for each answer in `said`. Only for homes, apartments and studios. Later calls add to earlier ones.",
  inputSchema: Living,
  label: { start: () => "Noting how you live" },
  async execute(facts, ctx) {
    const p = await getProject((await sessionProject(ctx)).id);
    const living = mergeLiving(livingOf(p.interview), facts);
    await updateProject(p.id, { interview: { ...p.interview, living } });
    // Tell the agent what's still open, so it asks for that next instead of guessing.
    return { saved: Object.keys(facts).filter((k) => k !== "said"), stillNeed: livingMissing(p.space_type, living) };
  },
});
