import { entitiesById, isHomeBrand, localStores, search, tagId, type Entity } from "../qloo/api.ts";
import type { Project } from "../project/store.ts";
import type { Layout } from "../layout/schema.ts";
import { furnish } from "../three/furniture.ts";
import { look } from "../three/materials.ts";
import { choicesOf, type Ticked } from "../green/improve.ts";
import { marketOf, projectTier, type Tier } from "../budget/costs.ts";
import { tasteTier, type PriceSignal } from "../budget/tier.ts";
import { creditOf } from "../design/trail.ts";
import { closeness } from "../plan-import/taste.ts";
import { alternatives, brandFor, cityParts, closestTo, isStoreOf, PIECES, piecesOf, priceEach, TIER_LEVEL, type BrandInfo, type Line } from "./list.ts";

// Builds the shopping list from Qloo: the brands in their taste with what each makes and its price level, each
// piece's best brand, cheaper and dearer rivals from the brand's own competitor tags, and furniture stores near the
// site ranked for their taste. Every call is cached, so a second visit is instant.

export type Store = { name: string; address: string };
export type Shopping = { tier: Tier; signals: PriceSignal[]; currency: string; lines: Line[]; stores: Store[] };

const tagsOf = (e: Entity, family: string) =>
  (e.tags ?? []).filter((t) => tagId(t).includes(`:${family}:`)).map((t) => ({ id: tagId(t).split(":").pop() ?? "", name: t.name ?? "" }));

/** Pure: what Amorphix needs to know about a brand entity. */
export function brandInfo(e: Entity, p: Pick<Project, "taste_signals" | "taste">): BrandInfo {
  const level = tagsOf(e, "price_level").map((t) => t.name.match(/^\$+$/)?.[0].length).find(Boolean);
  const c = creditOf(p, e.name);
  return {
    id: e.entity_id,
    name: e.name,
    image: e.properties?.image?.url,
    level,
    products: tagsOf(e, "product_service").map((t) => t.id.toLowerCase()),
    loved: c.loved,
    via: c.via,
    affinity: p.taste?.brands.find((b) => b.id === e.entity_id)?.affinity ?? (c.loved ? 1 : 0),
    instagram: (e.properties as { external?: { instagram?: { id?: string } } } | undefined)?.external?.instagram?.id,
  };
}

/** The brand's store in their city, checked by name and address, or null. One or two cached searches. */
async function storeNear(brand: string, location: string | null | undefined) {
  for (const city of location ? cityParts(location) : []) {
    const found = await search(`${brand} ${city}`, 5, "urn:entity:place").catch(() => []);
    const hit = found.find((e) => isStoreOf(brand, { name: e.name, address: e.properties?.address }, city));
    if (hit) return { name: hit.name, address: hit.properties?.address ?? city };
  }
  return null;
}
const rivalNames = (e: Entity) => [...tagsOf(e, "competitor_brand"), ...tagsOf(e, "similar_brand")].map((t) => t.name).filter(Boolean);

export async function shoppingFor(p: Project, tierOverride?: Tier): Promise<Shopping> {
  const layout = (p.options as Layout[] | null)?.[p.chosen_option ?? 0];
  if (!layout) return { tier: "mid", signals: [], currency: "USD", lines: [], stores: [] };
  const market = marketOf(p.site.location);
  const read = await tasteTier(p.taste_signals).catch(() => ({ tier: "mid" as Tier, signals: [] }));
  // where the whole project starts: the quality they told us, else what their taste points to
  const tier = tierOverride ?? projectTier(p, read.tier);

  const ticked = (Array.isArray(p.interview?.green) ? p.interview.green : []) as Ticked;
  const items = furnish(layout, { lush: look(p.brief as never, p.taste).lush, extraPlants: choicesOf(ticked).extra });
  const names = new Map(layout.floors.flatMap((f) => f.spaces.map((s) => [s.id, s.name] as const)));
  const pieces = piecesOf(items, (id) => names.get(id) ?? id);

  // The brands in their taste: the ones they named first, then those Qloo matched.
  const ids = [...p.taste_signals.filter((s) => s.layer === 2).map((s) => s.entityId), ...(p.taste?.brands ?? []).slice(0, 12).map((b) => b.id)];
  const found = (await entitiesById(ids)).filter(isHomeBrand);
  const brands = found.map((e) => brandInfo(e, p));
  const byId = new Map(found.map((e) => [e.entity_id, e]));

  // Rivals of each chosen brand, looked up once each, for the cheaper and dearer alternatives.
  const rivals = new Map<string, BrandInfo[]>();
  const rivalsOf = async (b: BrandInfo) => {
    if (!rivals.has(b.id)) {
      const looked = await Promise.all(
        rivalNames(byId.get(b.id)!).slice(0, 4).map(async (n) => {
          const hit = (await search(n, 3, "urn:entity:brand").catch(() => [])).find((e) => isHomeBrand(e) && closeness(n, e) >= 0.75);
          return hit ? brandInfo(hit, p) : null;
        }),
      );
      rivals.set(b.id, looked.filter((x): x is BrandInfo => !!x));
    }
    return rivals.get(b.id)!;
  };

  const lines: Line[] = [];
  for (const piece of pieces) {
    const brand = brandFor(piece.piece, brands, tier);
    // Rivals from the brand's own competitor tags, plus other brands in their taste that make the same piece.
    const makers = brands.filter((b) => b.id !== brand?.id && brandFor(piece.piece, [b], tier));
    const pool = brand ? [brand, ...(await rivalsOf(brand)), ...makers] : [];
    // The pick is whichever is nearest their tier, so a budget tier gets a budget brand; a brand they named, or
    // the first choice, wins a close call.
    const pick = pool.length ? closestTo(pool, TIER_LEVEL[tier], brand!) : null;
    const alt = pick ? alternatives(pick, pool) : { cheaper: null, dearer: null };
    lines.push({ ...piece, label: PIECES[piece.piece].label, each: priceEach(piece.piece, tier, market), brand: pick, ...alt });
  }

  // Every brand shown gets its store checked, so a link never opens a different shop.
  const shown = new Map<string, BrandInfo>();
  for (const l of lines) for (const b of [l.brand, l.cheaper, l.dearer]) if (b) shown.set(b.id, b);
  await Promise.all([...shown.values()].map(async (b) => (b.store = await storeNear(b.name, p.site.location))));
  for (const l of lines) for (const k of ["brand", "cheaper", "dearer"] as const) if (l[k]) l[k] = shown.get(l[k]!.id)!;

  const stores = p.site.location
    ? (await localStores(p.taste_signals.map((s) => s.entityId), p.site.location, "urn:tag:category:place:furniture_store", 5).catch(() => [])).map((e) => ({
        name: e.name,
        address: e.properties?.address ?? e.properties?.geocode?.city ?? "",
      }))
    : [];
  return { tier, signals: read.signals, currency: market.currency, lines, stores };
}
