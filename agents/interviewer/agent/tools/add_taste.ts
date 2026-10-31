import { defineTool } from "eve/tools";
import { z } from "zod";
import { layerOf } from "../../../../lib/qloo/taste.ts";
import { profileFor } from "../../../../lib/qloo/profile.ts";
import { addTasteSignals, updateProject } from "../../../../lib/project/store.ts";
import { profileSummary } from "../../../../lib/interview/logic.ts";
import { candidates, sessionProject } from "../lib/session.ts";

export default defineTool({
  description:
    "Add confirmed matches from find_taste to the user's taste, then rebuild their style profile. Returns the strongest style words with what they came from, and matching home brands, so you can reflect the style back in plain words.",
  inputSchema: z.object({ entityIds: z.array(z.string()).min(1).describe("entityId values from find_taste") }),
  label: { start: () => "Updating your taste profile" },
  async execute({ entityIds }, ctx) {
    const known = candidates.get();
    const unknown = entityIds.filter((id) => !known[id]);
    if (unknown.length) throw new Error(`Call find_taste first; these ids weren't found in this conversation: ${unknown.join(", ")}`);

    const p = await sessionProject(ctx);
    const added = entityIds.map((id) => known[id]);
    const updated = await addTasteSignals(
      p.id,
      added.map((e) => ({ entityId: e.entity_id, name: e.name, layer: layerOf(e), type: e.types?.[0] })),
    );

    const profile = await profileFor(updated.taste_signals, new Map(Object.entries(known)));
    await updateProject(p.id, { taste: profile });
    return { tasteCount: updated.taste_signals.length, ...profileSummary(profile) };
  },
});
