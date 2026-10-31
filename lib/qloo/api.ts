import { qloo } from "./client.ts";

export type QlooTag = { tag_id?: string; id?: string; name?: string };
export type Entity = {
  entity_id: string;
  name: string;
  types?: string[];
  subtype?: string;
  tags?: QlooTag[];
  popularity?: number;
  properties?: { image?: { url?: string }; geocode?: { city?: string }; address?: string; website?: string };
  query?: { affinity?: number; explainability?: Record<string, { entity_id: string; score: number }[]> };
};

export const tagId = (t: QlooTag) => t.tag_id ?? t.id ?? "";

/** `types`: only these entity types, comma separated (for example "urn:entity:brand"). */
export async function search(query: string, take = 5, types?: string): Promise<Entity[]> {
  const d = await qloo<{ results?: Entity[] }>("/search", { query, take, types });
  return d.results ?? [];
}

export async function insights(params: Record<string, string | number | boolean | undefined>): Promise<Entity[]> {
  const d = await qloo<{ results?: { entities?: Entity[] } }>("/v2/insights", params);
  return d.results?.entities ?? [];
}

const MEDIA = "urn:tag:brand_type:qloo:media_brand";
const SERVICE = "urn:tag:brand_type:qloo:service_brand";
// ponytail: a name check for clothing labels Qloo files under home goods; a product_service check if more slip through.
const CLOTHING = /swimwear|apparel|clothing|lingerie|fashion/i;

const INDUSTRY = "urn:tag:industry:qloo:";
// Industries that make things for a home. A brand whose industries are known but include none of these (a coffee
// roaster with a design shelf, a studio) is not one to furnish from; a brand with no industry tags is given the benefit.
const HOME_INDUSTRY = /home|furniture|furnishing|lighting|decor|architectural_hardware|textile|kitchen|bath|flooring|rug/;

/** A brand you could furnish a home from: not a magazine, an app or design firm, a café, or a clothing label. */
export const isHomeBrand = (b: Entity) => {
  const ids = (b.tags ?? []).map(tagId);
  const industries = ids.filter((t) => t.startsWith(INDUSTRY)).map((t) => t.slice(INDUSTRY.length));
  return !ids.some((t) => t === MEDIA || t === SERVICE) && !CLOTHING.test(b.name) && (!industries.length || industries.some((i) => HOME_INDUSTRY.test(i)));
};

/** Entities by id, in one call (their images, tags and properties). */
export async function entitiesById(ids: string[]): Promise<Entity[]> {
  if (!ids.length) return [];
  const d = await qloo<{ results?: Entity[] }>("/entities", { entity_ids: ids.join(",") });
  return d.results ?? [];
}

const CATEGORY = "urn:tag:category:place:";
// Places whose look is the outdoors or a holiday, not a room: nothing to borrow for a home or a shop.
const OUTDOORS = /camp|park|beach|trail|resort|marina|golf|ski|zoo|garden|lake|forest|mountain|island/;

// Budget chains: the same room in every city, nothing of anyone's taste in it.
const CHAIN = /\b(best western|holiday inn|novotel|ibis|hampton inn|comfort inn|days inn|super 8|travelodge|premier inn|motel 6|la quinta|courtyard by marriott|residence inn|fairfield inn|red roof|quality inn|econo lodge)\b/i;

/** A place whose rooms you could learn from: not a campsite, a park, a resort or a budget chain. A place with no category is kept. */
export const isRoomPlace = (e: Entity) =>
  !(e.tags ?? []).map(tagId).some((t) => t.startsWith(CATEGORY) && OUTDOORS.test(t.slice(CATEGORY.length))) && !/\b(campsite|campground|camping|resort)\b/i.test(e.name) && !CHAIN.test(e.name);

/** Places with a photo that share these decor tags and suit this taste: hotels, cafés and bars that look the part. */
export async function kindredPlaces(likedIds: string[], decorTags: string[], take = 6): Promise<Entity[]> {
  if (!likedIds.length || !decorTags.length) return [];
  const found = await insights({
    "filter.type": "urn:entity:place",
    "filter.tags": decorTags.join(","),
    "filter.exists": "properties.image",
    "signal.interests.entities": likedIds.join(","),
    take: take * 3,
  });
  return found.filter(isRoomPlace).slice(0, take);
}

// Home and design brands matched to a set of liked entities, with why each one was picked.
// Brands people know and can buy from (West Elm, CB2, One Kings Lane), still ranked by taste; the long tail only when
// too few well-known ones match.
export async function homeBrands(likedIds: string[], take = 25): Promise<Entity[]> {
  if (!likedIds.length) return [];
  const ask = (known: boolean) =>
    insights({
      "filter.type": "urn:entity:brand",
      "filter.tags": "urn:tag:industry:qloo:interior_design",
      ...(known ? { "filter.popularity.min": 0.8 } : {}),
      "signal.interests.entities": likedIds.join(","),
      "feature.explainability": true,
      take,
    }).then((b) => b.filter(isHomeBrand));
  const known = await ask(true);
  return known.length >= 6 ? known : [...known, ...(await ask(false)).filter((b) => !known.some((k) => k.entity_id === b.entity_id))];
}

/**
 * Wider and wider ways to say a place: "Koregaon Park, Pune, India", then "Pune, India". Qloo finds nothing for
 * many neighbourhood names, so a search steps out to the city. It never steps out to a country alone.
 */
export function placesToTry(location: string): string[] {
  const parts = location.split(",").map((x) => x.trim()).filter(Boolean);
  const last = parts.length > 2 ? parts.length - 2 : parts.length - 1;
  return Array.from({ length: Math.max(1, last + 1) }, (_, i) => parts.slice(i).join(", ")).filter(Boolean);
}

// Stores near a location, ranked by taste (e.g. furniture stores in "Austin, TX").
export async function localStores(likedIds: string[], location: string, categoryTag = "urn:tag:category:place:furniture_store", take = 8) {
  for (const place of placesToTry(location)) {
    const found = await insights({
      "filter.type": "urn:entity:place",
      "filter.tags": categoryTag,
      "filter.location.query": place,
      "signal.interests.entities": likedIds.join(",") || undefined,
      take,
    });
    if (found.length) return found;
  }
  return [];
}

// Taste affinity per geohash in an area, for designing a hotel, café or shop for its neighbourhood.
export async function heatmap(likedIds: string[], location: string) {
  const d = await qloo<{ results?: { heatmap?: { location: { latitude: number; longitude: number; geohash: string }; query: { affinity: number } }[] } }>(
    "/v2/insights",
    { "filter.type": "urn:heatmap", "filter.location.query": location, "signal.interests.entities": likedIds.join(",") },
  );
  return d.results?.heatmap ?? [];
}
