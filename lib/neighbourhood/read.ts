// Type-only: this file runs in the browser too, so it must not pull in the Qloo client.
import type { Entity, QlooTag } from "../qloo/api.ts";
import type { StyleTag } from "../qloo/taste.ts";

// The neighbourhood read for a business: the places of the same kind near the site, ranked by Qloo for the
// owner's taste (and the crowd they want), what those favourites look like, how strongly the area matches the
// owner's taste, and how the café they love runs. Pure: the Qloo and map calls are in fetch.ts.

/** Who the business is for. With a taste signal, Qloo re-ranks the same places for the crowd. */
export type Crowd = "all" | "young" | "mid" | "older";
export const CROWDS: Record<Crowd, { label: string; age?: string }> = {
  all: { label: "Everyone" },
  young: { label: "Under 25", age: "24_and_younger" },
  mid: { label: "36 to 55", age: "36_to_55" },
  older: { label: "Over 55", age: "55_and_older" },
};
export const isCrowd = (c: string | null): c is Crowd => !!c && c in CROWDS;

const CAT = "urn:tag:category:place:";

/** The places worth reading near each kind of business. An office reads where its team would get coffee and work. */
export const NEAR: Record<string, { tags: string[]; what: string }> = {
  cafe: { tags: ["cafe"], what: "cafés" },
  hotel: { tags: ["hotel"], what: "hotels" },
  office: { tags: ["cafe", "coworking_space"], what: "cafés and work spots" },
  shop: { tags: ["clothing_store", "gift_shop", "home_goods_store", "furniture_store"], what: "shops" },
};

const tagId = (t: QlooTag) => t.tag_id ?? t.id ?? "";
const idsOf = (e: Entity) => (e.tags ?? []).map(tagId);

// Qloo tags many places "cafe" because they have one inside (a cinema, an observation deck, a bar). A place counts
// as a café only if it is one: a coffee-type category or "café" in its name, and nothing that makes it something else.
const CAFE_LIKE = /:(coffee_shop|coffee_store|coffee_roastery|espresso_bar|tea_house|bakery|pastry_shop|cake_shop)$/;
const CAFE_NAME = /caf[eé]|coffee|kaffee|chai/i;
const NOT_A_CAFE = /:(movie_theater|observation_deck|observatory|museum|night_club|hotel|lodging|fine_dining_restaurant)$/;

/** Whether a place found near the site really is the kind of place this business is (not just tagged with it). */
export function isKind(type: string | null | undefined, e: Entity): boolean {
  const ids = idsOf(e);
  if (type === "cafe" || type === "office") {
    if (type === "office" && ids.some((t) => t.endsWith(":coworking_space"))) return true;
    return !ids.some((t) => NOT_A_CAFE.test(t)) && (ids.some((t) => CAFE_LIKE.test(t)) || CAFE_NAME.test(e.name));
  }
  if (type === "hotel") return ids.some((t) => /:(hotel|boutique_hotel|resort_hotel)$/.test(t));
  return true;
}

/** Category tags to look for near the site. A shop takes its kind from the shops the owner loves, when they named one. */
export function categoriesFor(type: string | null | undefined, loved: Entity[]): string[] {
  const near = NEAR[type ?? ""];
  if (!near) return [];
  if (type === "shop") {
    const own = [...new Set(loved.flatMap(idsOf).filter((t) => t.startsWith(CAT) && /(_store|_shop|boutique)$/.test(t)))];
    if (own.length) return own.slice(0, 3);
  }
  return near.tags.map((t) => CAT + t);
}

const LOOK = /^urn:tag:(?:decor|ambience):qloo:(.+)$/;
const lookWords = (e: Entity) => [...new Set(idsOf(e).map((t) => t.match(LOOK)?.[1]).filter((w): w is string => !!w))];
export const say = (w: string) => w.replace(/_/g, " ");

/** What the local favourites look like: their most common decor and ambience words, which of those are the owner's
 *  own, and how many favourites share at least one word with the owner's style. */
export function lookOf(places: Entity[], style: StyleTag[]) {
  const mine = new Set(style.filter((t) => t.family === "decor" || t.family === "ambience").map((t) => t.value));
  const count = new Map<string, number>();
  for (const p of places) for (const w of lookWords(p)) count.set(w, (count.get(w) ?? 0) + 1);
  const words = [...count]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([w, n]) => ({ word: say(w), n, yours: mine.has(w) }));
  const sharing = places.filter((p) => lookWords(p).some((w) => mine.has(w))).length;
  return { words, sharing, of: places.length };
}

export const placeLook = (e: Entity) => lookWords(e).slice(0, 4).map(say);

type Cell = { location: { latitude: number; longitude: number }; query: { affinity?: number; affinity_rank?: number } };

function km(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLon - aLon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * Where the site's area stands in its city for the owner's taste, as "top X%". Null when the city has too few
 * cells for a ranking to mean anything, or no cell is near the site: never a number made from thin data.
 */
export function areaRank(cells: Cell[], lat: number, lon: number, minCells = 50, maxKm = 1.5): number | null {
  if (cells.length < minCells) return null;
  let best: Cell | null = null;
  let bestKm = Infinity;
  for (const c of cells) {
    const d = km(lat, lon, c.location.latitude, c.location.longitude);
    if (d < bestKm) [best, bestKm] = [c, d];
  }
  if (!best || bestKm > maxKm) return null;
  const score = (c: Cell) => c.query.affinity_rank ?? c.query.affinity ?? 0;
  const above = cells.filter((c) => score(c) > score(best)).length;
  return Math.max(1, Math.ceil(((above + 1) / cells.length) * 100));
}

const EATS = new Set(["cafe", "coffee_shop", "coffee_roastery", "restaurant", "bakery"].map((t) => CAT + t));
const AWAY = /:(takeout|quick_bite|counter_service|ok_to_order_just_coffee)$/;
const SIT = /:(table_service|large_group)$/;
const OUTSIDE = /:outdoor_seating$/;

const HOW = { "dine-in": "mostly sit-down", takeaway: "mostly takeaway", both: "sit-down and takeaway" } as const;

export type RunningHint = { service?: "dine-in" | "takeaway" | "both"; outdoor?: boolean; from: string[] };

/**
 * How the cafés the owner loves run, as a suggestion they confirm (never an answer filled in for them): mostly
 * takeaway, sit-down, or both, and seats outside when most of them have them.
 */
export function runningHint(type: string | null | undefined, loved: Entity[]): RunningHint | null {
  if (type !== "cafe") return null;
  const cafes = loved.filter((e) => idsOf(e).some((t) => EATS.has(t)));
  if (!cafes.length) return null;
  const has = (re: RegExp) => cafes.filter((c) => idsOf(c).some((t) => re.test(t))).length;
  const [away, sit, out] = [has(AWAY), has(SIT), has(OUTSIDE)];
  const service = away && sit ? "both" : away ? "takeaway" : sit ? "dine-in" : undefined;
  const outdoor = out * 2 > cafes.length || undefined;
  return service || outdoor ? { service, outdoor, from: cafes.map((c) => c.name) } : null;
}

/** The hint in words: "Like Blue Tokai: sit-down and takeaway, with seats outside." */
export function hintLine(h: RunningHint) {
  const like = h.from.slice(0, 2).join(" and ");
  const how = HOW[h.service ?? "both"];
  const parts = [h.service && how, h.outdoor && (h.service ? "with seats outside" : "seats outside")].filter(Boolean);
  return `Like ${like}: ${parts.join(", ")}.`;
}

/** The area rank in words, honest either way: a weak match is room to stand out, not a number to hide. */
export function rankLine(rank: number, city: string) {
  const c = city.split(",")[0];
  if (rank <= 33) return { strength: "strong", text: `Top ${rank}% of ${c} for your taste: people around here already love places like yours.` };
  if (rank <= 66) return { strength: "average", text: `About average for ${c}: some of the crowd here shares your taste.` };
  return { strength: "weak", text: `Your taste is rarer here than in most of ${c}: room to stand out from what's around.` };
}


/** What they said in the interview, next to the hint: their answer stands, the hint only shows where it agrees. */
export function saidLine(said: { service: keyof typeof HOW | null; outdoor: boolean | null }, h: RunningHint) {
  if (!said.service) return null;
  const same = said.service === h.service && (h.outdoor === undefined || !!said.outdoor === h.outdoor);
  return { same, text: `You said ${HOW[said.service]}${said.outdoor ? ", with seats outside" : ""}.` };
}

const GENERIC = new Set(["the", "cafe", "café", "hotel", "le", "la", "el", "il", "da"]);

/** One place per chain: "Starbucks" and "Starbucks Coffee Company - Kalyan Nagar" are the same place to read. */
export function onePerChain<T extends { name: string }>(places: T[]): T[] {
  const key = (n: string) => {
    const w = n.toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, " ").split(/\s+/).filter(Boolean);
    return GENERIC.has(w[0]) ? w.slice(0, 2).join(" ") : (w[0] ?? "");
  };
  const seen = new Set<string>();
  return places.filter((p) => !seen.has(key(p.name)) && !!seen.add(key(p.name)));
}
