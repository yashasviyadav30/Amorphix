import { defineTool } from "eve/tools";
import { z } from "zod";
import { search } from "../../../../lib/qloo/api.ts";
import { toCandidate } from "../../../../lib/interview/logic.ts";
import { candidates } from "../lib/session.ts";

export default defineTool({
  description:
    "Look up things the user loves (a hotel, café, restaurant, brand, film, band, book, show, place they travelled) in Qloo's taste graph. Returns up to 3 matches per name. If the top match is clearly what they meant, add it with add_taste; if two matches are plausible, ask the user which one.",
  inputSchema: z.object({
    names: z.array(z.string().min(1)).min(1).max(6).describe("names as the user said them, with a city when they gave one, e.g. 'Ace Hotel New York'"),
  }),
  label: { start: ({ names }) => `Looking up ${names.join(", ")}` },
  async execute({ names }) {
    const found = await Promise.all(names.map((n) => search(n, 3)));
    candidates.update((all) => {
      const next = { ...all };
      for (const e of found.flat()) next[e.entity_id] = e;
      return next;
    });
    // An object, not a bare array: Gemini requires tool results to be JSON objects.
    return { results: names.map((name, i) => ({ asked: name, matches: found[i].map(toCandidate) })) };
  },
});
