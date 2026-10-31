import { entitiesById, isHomeBrand, kindredPlaces, tagId, type Entity } from "../qloo/api.ts";
import type { Profile } from "../qloo/taste.ts";
import type { TasteSignal } from "../project/store.ts";
import { kindOf } from "../interview/logic.ts";
import { creditOf } from "./trail.ts";

// The moodboard: real photos from Qloo of what the user loves, the home brands matched to them, and places
// elsewhere that share their look. Every photo says why it's there; nothing goes up without a reason.

export type Tile = { id: string; name: string; image: string; kind: "loved" | "matched" | "kindred"; caption: string };
type Taste = { taste_signals: TasteSignal[]; taste: Profile | null };

const DECOR = "urn:tag:decor:qloo:";
const label = (v: string) => v.replaceAll("_", " ");
const imageOf = (e: Entity) => e.properties?.image?.url;

/** The decor tags behind their style, from things they named (a matched brand's decor never leads). */
export function decorTags(p: Taste, n = 4): string[] {
  return (p.taste?.tags ?? [])
    // "standardized chain" describes a chain hotel, not a look anyone wants to borrow
    .filter((t) => t.family === "decor" && t.value !== "standardized_chain" && t.sources.some((s) => s.layer !== 3))
    .slice(0, n)
    .map((t) => `${DECOR}${t.value}`);
}

/**
 * Pure: the tiles, each with its caption. What they love first, then places that share their look (real rooms),
 * then a few matched brands (often only a logo, so they come last and stay few).
 */
export function tiles(p: Taste, found: Entity[], kindred: Entity[], max = 12, brandMax = 3): Tile[] {
  const byId = new Map(found.map((e) => [e.entity_id, e]));
  const out: Tile[] = [];
  const seen = new Set<string>();
  const push = (t: Tile) => !seen.has(t.id) && t.image && (seen.add(t.id), out.push(t));
  for (const s of p.taste_signals) {
    const e = byId.get(s.entityId);
    const image = e && imageOf(e);
    if (image) push({ id: s.entityId, name: s.name, image, kind: "loved", caption: `You love this ${s.layer === 1 ? "place" : s.layer === 2 ? "brand" : kindOf(s.type)}` });
  }
  const brandTiles: Tile[] = [];
  for (const b of p.taste?.brands ?? []) {
    if (brandTiles.length === brandMax) break;
    const e = byId.get(b.id);
    const image = e && imageOf(e);
    // Re-checked here so projects matched before the home-brand filter don't show an app or a design firm.
    if (!image || !isHomeBrand(e)) continue;
    const via = creditOf(p, b.name).via;
    brandTiles.push({ id: b.id, name: b.name, image, kind: "matched", caption: via.length ? `Matched to ${via.slice(0, 2).join(" and ")}` : "Matched to your taste" });
  }
  const mine = new Set(decorTags(p, 8));
  for (const e of kindred) {
    const image = imageOf(e);
    const shared = (e.tags ?? []).map(tagId).filter((t) => mine.has(t)).map((t) => label(t.slice(DECOR.length)));
    if (!image || !shared.length) continue;
    const city = e.properties?.geocode?.city;
    push({ id: e.entity_id, name: e.name, image, kind: "kindred", caption: `Shares your ${shared.slice(0, 2).join(", ")} look${city ? ` · ${city}` : ""}` });
  }
  for (const t of brandTiles) push(t);
  return out.slice(0, max);
}

/** Looks the photos up in Qloo (two calls, both cached) and builds the tiles. */
export async function moodboard(p: Taste): Promise<Tile[]> {
  const loved = p.taste_signals.map((s) => s.entityId);
  const brands = (p.taste?.brands ?? []).slice(0, 8).map((b) => b.id);
  const [found, kindred] = await Promise.all([
    entitiesById([...loved, ...brands]),
    kindredPlaces(loved, decorTags(p)).catch(() => []), // a slow insight never costs the whole board
  ]);
  return tiles(p, found, kindred);
}
