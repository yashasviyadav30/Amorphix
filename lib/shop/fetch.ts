import type { Project } from "../project/store.ts";
import type { Layout } from "../layout/schema.ts";
import { furnish } from "../three/furniture.ts";
import { look } from "../three/materials.ts";
import { choicesOf, type Ticked } from "../green/improve.ts";
import { marketOf, projectTier, type Tier } from "../budget/costs.ts";
import { tasteTier, type PriceSignal } from "../budget/tier.ts";
import { creditOf } from "../design/trail.ts";
import { BRANDS, logoOf, makesOf, type BrandEntry } from "../taste/brands.ts";
import { alternatives, brandFor, PIECES, piecesOf, priceEach, type BrandInfo, type Line } from "./list.ts";

// Builds the shopping list from Amorphix's brand catalogue: the brands closest to their taste with what each makes
// and its price level, each piece's best brand, and a cheaper and a dearer brand from the catalogue that make it too.

export type Store = { name: string; address: string };
export type Shopping = { tier: Tier; signals: PriceSignal[]; currency: string; lines: Line[]; stores: Store[] };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Pure: what the shopping list needs to know about a catalogue brand. */
export function brandInfo(e: BrandEntry, p: Pick<Project, "taste_signals" | "taste">): BrandInfo {
  const c = creditOf(p, e.name);
  const loved = p.taste_signals.some((s) => same(s.name, e.name));
  return {
    id: e.id,
    name: e.name,
    image: logoOf(e),
    site: e.site,
    level: e.level,
    products: makesOf(e),
    loved,
    via: c.via,
    affinity: p.taste?.brands.find((b) => b.id === e.id)?.affinity ?? (loved ? 1 : 0),
  };
}

export async function shoppingFor(p: Project, tierOverride?: Tier): Promise<Shopping> {
  const layout = (p.options as Layout[] | null)?.[p.chosen_option ?? 0];
  if (!layout) return { tier: "mid", signals: [], currency: "USD", lines: [], stores: [] };
  const market = marketOf(p.site.location);
  const read = tasteTier(p.taste);
  // where the whole project starts: the quality they told us, else what their taste points to
  const tier = tierOverride ?? projectTier(p, read.tier);

  const ticked = (Array.isArray(p.interview?.green) ? p.interview.green : []) as Ticked;
  const items = furnish(layout, { lush: look(p.brief as never, p.taste).lush, extraPlants: choicesOf(ticked).extra });
  const names = new Map(layout.floors.flatMap((f) => f.spaces.map((s) => [s.id, s.name] as const)));
  const pieces = piecesOf(items, (id) => names.get(id) ?? id);

  // The brands in their taste: any they named first, then the closest matches.
  const named = BRANDS.filter((b) => p.taste_signals.some((s) => same(s.name, b.name)));
  const matched = (p.taste?.brands ?? []).slice(0, 12).flatMap((m) => BRANDS.filter((b) => b.id === m.id));
  const brands = [...new Map([...named, ...matched].map((b) => [b.id, brandInfo(b, p)])).values()];
  // Every catalogue brand can stand in as a cheaper or dearer choice for a piece.
  const catalogue = BRANDS.map((b) => brandInfo(b, p));

  // Each use of a brand lowers its pull a little, so a close second gets some pieces and the list isn't one brand.
  const used = new Map<string, number>();
  const lines: Line[] = pieces.map((piece) => {
    const fresh = brands.map((b) => ({ ...b, affinity: b.affinity - 0.5 * (used.get(b.id) ?? 0) }));
    const brand = brands.find((b) => b.id === brandFor(piece.piece, fresh, tier)?.id) ?? null;
    const pool = brand ? [brand, ...catalogue.filter((b) => b.id !== brand.id && brandFor(piece.piece, [b], tier))] : [];
    const pick = brand;
    const alt = pick ? alternatives(pick, pool) : { cheaper: null, dearer: null };
    if (pick) used.set(pick.id, (used.get(pick.id) ?? 0) + 1);
    return { ...piece, label: PIECES[piece.piece].label, each: priceEach(piece.piece, tier, market), brand: pick, ...alt };
  });
  return { tier, signals: read.signals, currency: market.currency, lines, stores: [] };
}
