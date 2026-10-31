import { defineTool } from "eve/tools";
import { z } from "zod";
import { addTasteSignals } from "../../../../lib/project/store.ts";
import { chatModel } from "../../../../lib/models.ts";
import { describe } from "../../../../lib/taste/describe.ts";
import { sessionProject } from "../lib/session.ts";

export default defineTool({
  description:
    "Add things the user loves (a hotel, café, brand, film, band, show, place they travelled) to their taste. Returns each one's kind and the look it evokes, so you can reflect their style back in plain words.",
  inputSchema: z.object({
    names: z.array(z.string().min(1)).min(1).max(6).describe("names as the user said them, with a city when they gave one, e.g. 'Ace Hotel New York'"),
  }),
  label: { start: () => "Updating your taste profile" },
  async execute({ names }, ctx) {
    const p = await sessionProject(ctx);
    const read = await describe(names, chatModel());
    const updated = await addTasteSignals(
      p.id,
      read.map((d) => ({ entityId: `name:${d.name.toLowerCase()}`, name: d.name, layer: d.layer, type: d.kind })),
    );
    // An object, not a bare array: Gemini requires tool results to be JSON objects.
    return { tasteCount: updated.taste_signals.length, added: read.map((d) => ({ name: d.name, kind: d.kind, look: d.description })) };
  },
});
