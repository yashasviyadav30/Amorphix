import { defineTool } from "eve/tools";
import { getProject, updateProject } from "../../../../lib/project/store.ts";
import { Running, mergeRunning, runningMissing, runningOf } from "../../../../lib/interview/running.ts";
import { sessionProject } from "../lib/session.ts";

export default defineTool({
  description:
    "Save how a business runs day to day. Café: seats, dine-in or takeaway, full kitchen or coffee and light prep, outdoor seating. Office: how many people, focused or together work, visitors. Shop: browse an open floor or show off pieces to the street, fitting rooms. Hotel: guest rooms on a floor. Numbers (seats, people, fittingRooms, rooms) go in their own fields as numbers, as well as their words in `said`. Put the user's own few words for each answer in `said`. Only for cafés, offices, shops and hotels. Later calls add to earlier ones.",
  inputSchema: Running,
  label: { start: () => "Noting how you run it" },
  async execute(facts, ctx) {
    const p = await getProject((await sessionProject(ctx)).id);
    const running = mergeRunning(runningOf(p.interview), facts);
    await updateProject(p.id, { interview: { ...p.interview, running } });
    // Tell the agent what's still open, so it asks for that next instead of guessing.
    return { saved: Object.keys(facts).filter((k) => k !== "said" && k in running), stillNeed: runningMissing(p.space_type, running) };
  },
});
