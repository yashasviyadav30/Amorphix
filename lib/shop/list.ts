import type { Item } from "../three/furniture.ts";
import type { Market, Tier } from "../budget/costs.ts";

// The shopping list: every piece the 3D places that you would buy (furniture, lights, rugs, plants, appliances),
// counted, with a brand that makes it from the brands in their taste, a cheaper and a dearer alternative, and a
// rough price at their quality tier. Fitted work (kitchen runs, baths) is in the budget's kitchen and bath lines.

/** What a brand is, for choosing: its price level (1 to 4), what it makes, and how it reached them. */
export type BrandInfo = {
  id: string;
  name: string;
  image?: string;
  level?: number;
  products: string[];
  loved: boolean;
  via: string[];
  affinity: number;
  /** A store of this brand checked to be in their city, and the brand's official Instagram handle. */
  store?: { name: string; address: string } | null;
  instagram?: string;
};

const WORD = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w && w !== "the" && w !== "and");

/**
 * Whether a place is this brand's store in this city: every word of the brand in the place's name ("west elm",
 * "Roche Bobois - Mumbai"), and the city in its address. "Ethan Allen Hwy" BBQ in Connecticut is neither.
 */
export function isStoreOf(brand: string, place: { name: string; address?: string }, city: string): boolean {
  const name = WORD(place.name);
  const brandWords = WORD(brand);
  const cityWords = WORD(city);
  const addr = WORD(place.address ?? "");
  return brandWords.length > 0 && brandWords.every((w) => name.includes(w)) && cityWords.length > 0 && cityWords.every((w) => addr.includes(w) || name.includes(w));
}

/** The parts of a location that could be its city, most specific first: "Koregaon Park, Pune, India" -> Koregaon Park, Pune. */
export const cityParts = (location: string) => {
  const parts = location.split(",").map((x) => x.trim()).filter(Boolean);
  return parts.length > 2 ? parts.slice(0, -1) : parts.slice(0, 2).filter((p) => !/^[A-Z]{2}$/.test(p));
};

type Piece = { label: string; usd: number; makes: RegExp };
// Typical mid-range US prices per piece (2025-26 retail), and words in a brand's product tags that mean it makes it.
export const PIECES: Record<string, Piece> = {
  sofa: { label: "Sofa", usd: 1400, makes: /sofa|couch|seating|living_room_furniture/ },
  armchair: { label: "Armchair", usd: 550, makes: /armchair|chair|seating|living_room_furniture/ },
  "coffee table": { label: "Coffee table", usd: 300, makes: /coffee_table|table|living_room_furniture/ },
  "media unit": { label: "TV unit", usd: 650, makes: /tv_console|media|console|cabinet|storage/ },
  rug: { label: "Rug", usd: 450, makes: /rug|carpet|runner/ },
  "floor lamp": { label: "Floor lamp", usd: 160, makes: /lamp|lighting|light/ },
  bed: { label: "Bed", usd: 1300, makes: /bed|mattress|bedroom_furniture/ },
  wardrobe: { label: "Wardrobe", usd: 900, makes: /wardrobe|closet|storage/ },
  "dining set": { label: "Dining table and chairs", usd: 1600, makes: /dining|table|chair/ },
  sideboard: { label: "Sideboard", usd: 750, makes: /sideboard|cabinet|storage/ },
  desk: { label: "Desk", usd: 450, makes: /desk|office_furniture/ },
  "office chair": { label: "Desk chair", usd: 320, makes: /chair|office_furniture|seating/ },
  bookshelf: { label: "Bookshelf", usd: 280, makes: /shelv|bookcase|storage/ },
  shelving: { label: "Shelving", usd: 220, makes: /shelv|storage/ },
  "cafe table": { label: "Table and chairs", usd: 450, makes: /table|chair|dining/ },
  "desk row": { label: "Row of desks and chairs", usd: 1800, makes: /desk|office_furniture|workstation/ },
  "meeting set": { label: "Meeting table and chairs", usd: 2600, makes: /table|conference|office_furniture/ },
  "reception desk": { label: "Reception desk", usd: 1800, makes: /desk|reception|office_furniture/ },
  "display table": { label: "Display table", usd: 700, makes: /table|display|retail/ },
  mirror: { label: "Mirror", usd: 180, makes: /mirror|decor|accessor/ },
  "wall screen": { label: "Wall screen", usd: 700, makes: /tv|screen|electronic/ },
  washer: { label: "Washing machine", usd: 700, makes: /washer|washing|laundry|appliance/ },
  plant: { label: "Plant in a pot", usd: 45, makes: /plant|garden|planter/ },
  "wall plant": { label: "Shelf plant", usd: 35, makes: /plant|garden|planter/ },
};
// Furniture prices spread wider across tiers than building work does.
const TIER_PRICE: Record<Tier, number> = { essential: 0.55, mid: 1, premium: 2.2, luxury: 4 };
export const TIER_LEVEL: Record<Tier, number> = { essential: 1, mid: 2, premium: 3, luxury: 4 };

export type Line = { piece: string; label: string; qty: number; rooms: string[]; each: number; brand: BrandInfo | null; cheaper: BrandInfo | null; dearer: BrandInfo | null };

/** The pieces to buy, grouped and counted, biggest spend first. `roomName` turns a room id into its name. */
export function piecesOf(items: Item[], roomName: (id: string) => string): { piece: string; qty: number; rooms: string[] }[] {
  const by = new Map<string, { piece: string; qty: number; rooms: string[] }>();
  for (const it of items) {
    if (!PIECES[it.name]) continue;
    const g = by.get(it.name) ?? { piece: it.name, qty: 0, rooms: [] };
    g.qty++;
    const room = roomName(it.room);
    if (!g.rooms.includes(room)) g.rooms.push(room);
    by.set(it.name, g);
  }
  return [...by.values()].sort((a, b) => PIECES[b.piece].usd * b.qty - PIECES[a.piece].usd * a.qty);
}

/** The price of one piece at this tier, in the market's currency. */
export const priceEach = (piece: string, tier: Tier, m: Market) => PIECES[piece].usd * TIER_PRICE[tier] * m.interiors * m.fx;

/**
 * The brand to buy a piece from: one that makes it (its product tags), near their price tier, and preferring
 * brands they named over brands Qloo matched, then the closer match. Null when no brand in their taste makes it.
 */
export function brandFor(piece: string, brands: BrandInfo[], tier: Tier): BrandInfo | null {
  const makes = PIECES[piece]?.makes;
  if (!makes) return null;
  const want = TIER_LEVEL[tier];
  const scored = brands
    .map((b) => ({ b, hits: b.products.filter((p) => makes.test(p)).length }))
    .filter((x) => x.hits > 0)
    .map(({ b, hits }) => ({ b, score: hits * 3 + (b.loved ? 2 : 0) + b.affinity - (b.level ? Math.abs(b.level - want) * 1.5 : 0.5) }));
  return scored.sort((x, y) => y.score - x.score)[0]?.b ?? null;
}

/** From a brand's competitors, the closest one a level cheaper and the closest a level dearer. */
export function alternatives(brand: BrandInfo, rivals: BrandInfo[]): { cheaper: BrandInfo | null; dearer: BrandInfo | null } {
  const lvl = brand.level ?? 2;
  const priced = rivals.filter((r) => r.level && r.id !== brand.id);
  const cheaper = priced.filter((r) => r.level! < lvl).sort((a, b) => b.level! - a.level!)[0] ?? null;
  const dearer = priced.filter((r) => r.level! > lvl).sort((a, b) => a.level! - b.level!)[0] ?? null;
  return { cheaper, dearer };
}

/** From brands that make a piece, the one whose price level is nearest `want`; loved brands and `first` win close calls. */
export function closestTo(pool: BrandInfo[], want: number, first: BrandInfo): BrandInfo {
  const cost = (b: BrandInfo) => Math.abs((b.level ?? 2) - want) - (b.loved ? 0.6 : 0) - (b.id === first.id ? 0.4 : 0);
  return [...pool].sort((a, b) => cost(a) - cost(b))[0];
}
