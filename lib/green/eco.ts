import { entitiesById, isHomeBrand, localStores, tagId, type Entity } from "../qloo/api.ts";
import type { Profile } from "../qloo/taste.ts";
import type { TasteSignal } from "../project/store.ts";
import { creditOf } from "../design/trail.ts";

// The green side of their taste, from Qloo: what the brands they love (or were matched to) do for the planet, and
// plant nurseries near the site ranked for their taste.

export type EcoBrand = { name: string; loved: boolean; via: string[]; does: string[] };
export type Nursery = { name: string; address: string };
type Taste = { taste_signals: TasteSignal[]; taste: Profile | null };

const ECO = "urn:tag:sustainability_initiative:";

/** Pure: brands with sustainability tags, loved ones first, each with what it does. */
export function ecoBrands(p: Taste, found: Entity[]): EcoBrand[] {
  const out: EcoBrand[] = [];
  for (const e of found) {
    if (!(e.types ?? []).includes("urn:entity:brand") || !isHomeBrand(e)) continue;
    const does = (e.tags ?? []).filter((t) => tagId(t).startsWith(ECO)).map((t) => t.name ?? tagId(t).slice(ECO.length).replaceAll("_", " "));
    if (!does.length) continue;
    const c = creditOf(p, e.name);
    out.push({ name: e.name, loved: c.loved, via: c.via, does: does.slice(0, 4) });
  }
  return out.sort((a, b) => Number(b.loved) - Number(a.loved));
}

/** Looks the brands and nearby nurseries up in Qloo (cached). */
export async function ecoFor(p: Taste & { site: { location?: string | null } }): Promise<{ brands: EcoBrand[]; nurseries: Nursery[] }> {
  const loved = p.taste_signals.map((s) => s.entityId);
  const ids = [...p.taste_signals.filter((s) => s.layer === 2).map((s) => s.entityId), ...(p.taste?.brands ?? []).slice(0, 10).map((b) => b.id)];
  const [found, near] = await Promise.all([
    entitiesById(ids),
    p.site.location ? localStores(loved, p.site.location, "urn:tag:category:place:plant_nursery", 4).catch(() => []) : Promise.resolve([]),
  ]);
  return {
    brands: ecoBrands(p, found),
    nurseries: near.map((e) => ({ name: e.name, address: e.properties?.address ?? e.properties?.geocode?.city ?? "" })),
  };
}
