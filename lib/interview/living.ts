import { z } from "zod";

// How a household lives in its home. These answers decide which plan concepts fit them: an open great room
// for people who cook while talking to family, a split plan for parents who want the kids' rooms apart.
// The schema stays loose (no lengths or bounds) because Gemini rejects complex tool schemas; code checks it.

export const HOME_TYPES = new Set(["house", "apartment", "studio"]);

export const Living = z.object({
  kitchen: z.enum(["open", "semi", "closed"]).optional().describe("open to the living area, half open, or its own room"),
  entertaining: z.enum(["often", "sometimes", "rarely"]).optional().describe("how often they have people over"),
  overnightGuests: z.boolean().optional().describe("guests sometimes stay the night"),
  bedrooms: z.enum(["together", "apart"]).optional().describe("bedrooms close together, or the main bedroom apart from the others"),
  workVisitors: z.boolean().optional().describe("clients or colleagues come to the home office"),
  outlook: z.enum(["garden", "street", "either"]).optional().describe("which way the living room should face"),
  said: z
    .record(z.string(), z.string())
    .optional()
    .describe("the user's own words for each answer, a few words each, keyed like the fields above, e.g. {kitchen: 'I cook while the kids do homework'}"),
});
export type Living = z.infer<typeof Living>;

const SAID_MAX = 140;

/** The living answers saved on a project, or {} if there are none or they are malformed. */
export function livingOf(interview: Record<string, unknown> | null | undefined): Living {
  const r = Living.safeParse(interview?.living ?? {});
  return r.success ? r.data : {};
}

/** New answers on top of old ones; quotes merge per key and are trimmed to a sentence. */
export function mergeLiving(prev: Living, next: Living): Living {
  const said = { ...prev.said, ...next.said };
  for (const k of Object.keys(said)) said[k] = said[k].trim().slice(0, SAID_MAX);
  const out: Living = { ...prev, ...next };
  if (Object.keys(said).length) out.said = said;
  return out;
}

/** What the interview still needs to know about daily life before the plans can be chosen, or null. */
export function livingMissing(spaceType: string | null | undefined, living: Living): string | null {
  if (!spaceType || !HOME_TYPES.has(spaceType)) return null;
  const gaps = [
    !living.kitchen && "whether the kitchen should be open to the living area or a room of its own",
    !living.bedrooms && "whether the bedrooms should be close together or the main bedroom apart",
  ].filter(Boolean);
  return gaps.length ? `how they live: ${gaps.join(", and ")}` : null;
}
