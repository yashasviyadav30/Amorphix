import { z } from "zod";

// How a business runs day to day: a café that's mostly takeaway wants its counter on the street, an office of
// people doing focused work wants quiet rooms away from the open floor. These answers pick the plans and size
// the rooms, the way the living answers do for a home. Loose schema (Gemini rejects bounds); code checks it.

export const BUSINESS_TYPES = new Set(["cafe", "office", "shop", "hotel"]);

export const Running = z.object({
  // Café or restaurant
  seats: z.number().optional().describe("café or restaurant: how many people seated at once"),
  service: z.enum(["dine-in", "takeaway", "both"]).optional().describe("café: do most people sit down, take away, or both"),
  kitchen: z.enum(["full", "prep"]).optional().describe("café: a full cooking kitchen, or only coffee and light prep"),
  outdoor: z.boolean().optional().describe("café: they want seating outside, in a garden, patio or courtyard"),
  // Office
  people: z.number().optional().describe("office: how many people work there on a normal day"),
  work: z.enum(["focus", "together", "mixed"]).optional().describe("office: mostly heads-down focus, mostly working together, or a mix"),
  visitors: z.boolean().optional().describe("office: clients or visitors come in"),
  // Shop
  display: z.enum(["browse", "showcase"]).optional().describe("shop: customers wander and browse an open floor, or a few pieces are shown off to the street"),
  fittingRooms: z.number().optional().describe("shop: how many fitting rooms, 0 if none"),
  // Hotel (a typical guest floor: its size comes from how many rooms it holds)
  rooms: z.number().optional().describe("hotel: how many guest rooms on a floor"),
  said: z
    .record(z.string(), z.string())
    .optional()
    .describe("the user's own words for each answer, a few words each, keyed like the fields above, e.g. {service: 'mostly students grabbing coffee to go'}"),
});
export type Running = z.infer<typeof Running>;

const SAID_MAX = 140;
const COUNTS = ["seats", "people", "fittingRooms", "rooms"] as const;
// Above these a number is a typo or a different project (a stadium, not a café).
const MAX: Record<(typeof COUNTS)[number], number> = { seats: 400, people: 500, fittingRooms: 20, rooms: 60 };

/** The running answers saved on a project, or {} if there are none or they are malformed. */
export function runningOf(interview: Record<string, unknown> | null | undefined): Running {
  const r = Running.safeParse(interview?.running ?? {});
  return r.success ? r.data : {};
}

/** New answers on top of old ones: counts are whole numbers in a sane range (else dropped), quotes trimmed. */
export function mergeRunning(prev: Running, next: Running): Running {
  const out: Running = { ...prev, ...next };
  // A count the model only quoted ("12 people in a design studio") is still a count.
  for (const k of COUNTS) {
    const n = out[k] === undefined && next.said?.[k]?.match(/\d+/);
    if (n) out[k] = Number(n[0]);
  }
  for (const k of COUNTS) {
    const v = out[k];
    if (v === undefined) continue;
    if (!Number.isFinite(v) || v < 0 || v > MAX[k]) delete out[k];
    else out[k] = Math.round(v);
  }
  const said = { ...prev.said, ...next.said };
  for (const k of Object.keys(said)) said[k] = said[k].trim().slice(0, SAID_MAX);
  if (Object.keys(said).length) out.said = said;
  else delete out.said;
  return out;
}

/** What the interview still needs to know about how the business runs before plans can be chosen, or null. */
export function runningMissing(spaceType: string | null | undefined, r: Running): string | null {
  const gaps: Record<string, (string | false)[]> = {
    cafe: [!r.service && "whether most customers sit down or take away", !r.kitchen && "whether they cook full meals or only make coffee and light food"],
    office: [r.people === undefined && "how many people work there", !r.work && "whether the work is mostly focused, mostly together, or a mix"],
    shop: [!r.display && "whether customers browse an open floor or a few pieces are shown off to the street"],
    hotel: [!r.rooms && "how many guest rooms go on a floor"],
  };
  const open = (gaps[spaceType ?? ""] ?? []).filter(Boolean);
  return open.length ? `how they run it: ${open.join(", and ")}` : null;
}

/** Sizing lines for the room program, from the numbers they gave. Empty when they gave none. */
export function runningSizes(spaceType: string | null | undefined, r: Running): string[] {
  const out: string[] = [];
  if (spaceType === "cafe") {
    if (r.seats) out.push(`Seat ${r.seats} people: about 1.4 square metres per seat in the seating area${r.service === "takeaway" ? ", fewer if most people take away" : ""}.`);
    if (r.kitchen === "prep") out.push("Only coffee and light food: a small prep kitchen behind the counter, about 8 to 10 square metres.");
    if (r.kitchen === "full") out.push("Full meals: a real kitchen, about a third of the seating area, with its own store room.");
    if (r.service === "takeaway" || r.service === "both") out.push("A longer counter with room for a queue near the front door.");
  }
  if (spaceType === "office") {
    if (r.people) out.push(`Desks for ${r.people} people: about 6 square metres per person in the open workspace.`);
    if (r.work === "focus") out.push("Mostly focused work: at least one focus room per eight people.");
    if (r.work === "together") out.push("Mostly working together: a bigger meeting room and a shared table area.");
    if (r.visitors) out.push("Visitors come in: a reception and a meeting room near the front door.");
  }
  if (spaceType === "shop" && r.fittingRooms !== undefined) out.push(r.fittingRooms ? `${r.fittingRooms} fitting rooms, about 2 square metres each.` : "No fitting rooms.");
  if (spaceType === "hotel" && r.rooms) out.push(`${r.rooms} guest rooms on the floor.`);
  return out;
}
