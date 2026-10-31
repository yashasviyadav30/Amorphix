import type { Entity } from "../qloo/api.ts";
import { toCandidate, type Candidate } from "../interview/logic.ts";

// The three taste questions on the check screen. Each takes only its own kind of thing, and only a match whose
// name is what the user typed: "marvels techy science fiction" is a genre, not a film, and Qloo's nearest
// guess for it (a bookstore) must never style someone's home.

export const SLOTS = [
  { id: "place", label: "A hotel, café or restaurant you love", example: "Ace Hotel New York", types: ["urn:entity:place"] },
  { id: "brand", label: "A brand whose things you love using", example: "Muji", types: ["urn:entity:brand"] },
  {
    id: "media",
    label: "A film, show or music you love",
    example: "Interstellar",
    types: ["urn:entity:movie", "urn:entity:tv_show", "urn:entity:artist", "urn:entity:album"],
  },
] as const;
export type SlotId = (typeof SLOTS)[number]["id"];
export const slotOf = (id: string) => SLOTS.find((s) => s.id === id);

const STOP = new Set(["the", "a", "an", "and", "of", "in", "at", "my", "i", "love", "&"]);
const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w));
// "marvels" finds "marvel", "cafe" finds "café": the same word give or take an ending.
const same = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

/** How much of what the user typed is in the match's name or address, from 0 to 1. */
export function closeness(query: string, e: Entity): number {
  const q = words(query);
  if (!q.length) return 0;
  const hay = words(`${e.name} ${e.properties?.address ?? ""} ${e.properties?.geocode?.city ?? ""}`);
  return q.filter((w) => hay.some((h) => same(w, h))).length / q.length;
}

export const CLOSE = 0.75;

/** Up to three matches of the right kind whose names are what the user typed, best first. */
/** `near`: the project's city; for places, ones whose address is in it come first. */
export function matchesFor(slot: SlotId, query: string, found: Entity[], near = ""): Candidate[] {
  const types: readonly string[] = slotOf(slot)!.types;
  const city = near.split(",")[0].trim().toLowerCase();
  const local = (e: Entity) => (city && slot === "place" && JSON.stringify(e.properties ?? {}).toLowerCase().includes(city) ? 1 : 0);
  return found
    .filter((e) => e.types?.some((t) => types.includes(t)) && closeness(query, e) >= CLOSE)
    .map((e, i) => ({ e, i, c: closeness(query, e), l: local(e) }))
    .sort((p, q) => q.l - p.l || q.c - p.c || p.i - q.i)
    .slice(0, 3)
    .map(({ e }) => toCandidate(e));
}

/** What to tell someone whose answer found nothing of the right kind. */
export function vagueHint(slot: SlotId): string {
  const s = slotOf(slot)!;
  const what = slot === "place" ? "one hotel, café or restaurant by name" : slot === "brand" ? "one brand by name" : "one film, show, artist or album by name";
  return `We couldn't find that. Name ${what}, like ${s.example}.`;
}

export type Pick = { slot: SlotId; id: string; name: string };

/**
 * One pick as its Qloo entity. The browser only sends an id and a name, so it is looked up again and must still be
 * the same entity, of the right kind for its question; anything else is refused.
 */
export async function confirmPick(p: Pick, find: (q: string, take: number, types: string) => Promise<Entity[]>): Promise<Entity> {
  const s = slotOf(p.slot);
  if (!s) throw new Error("That isn't one of the taste questions.");
  const types: readonly string[] = s.types;
  const e = (await find(p.name, 10, types.join(","))).find((x) => x.entity_id === p.id && x.types?.some((t) => types.includes(t)));
  if (!e) throw new Error(`We couldn't confirm "${p.name}". Pick it again under "${s.label}".`);
  return e;
}

/** The user's three picks as Qloo entities, one for each question, each confirmed with `confirmPick`. */
export async function resolvePicks(picks: Pick[], find: (q: string, take: number, types: string) => Promise<Entity[]>): Promise<Entity[]> {
  return Promise.all(
    SLOTS.map(async (s) => {
      const p = picks.find((x) => x.slot === s.id);
      if (!p) throw new Error(`Answer "${s.label}" first.`);
      return confirmPick(p, find);
    }),
  );
}
