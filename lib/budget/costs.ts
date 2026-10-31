import type { Layout } from "../layout/schema.ts";
import { RATES, regionOf } from "./rates.ts";

// What a design costs: each room's area times rates by trade, at a quality tier, in the site's market, region and
// currency. Each market has its own researched rates for every tier (rates.ts); furniture and plants follow the
// market's retail prices. They are early estimates, not quotes: every figure is a low-high range, and the page
// says so.

export const TIERS = ["essential", "mid", "premium", "luxury"] as const;
export type Tier = (typeof TIERS)[number];
// Furniture spreads wider across tiers than building work (a budget sofa to a designer one).
const FURNITURE_TIER: Record<Tier, number> = { essential: 0.55, mid: 1, premium: 2.2, luxury: 4 };
export const TIER_NAMES: Record<Tier, string> = { essential: "Essential", mid: "Mid-range", premium: "Premium", luxury: "Luxury" };

export type Category = "construction" | "finishes" | "electrical" | "kitchen" | "bath" | "furniture" | "plants" | "fees";
export const CATEGORY_NAMES: Record<Category, string> = {
  construction: "Construction",
  finishes: "Floors, walls and ceilings",
  electrical: "Electrical and lighting",
  kitchen: "Kitchen",
  bath: "Bathrooms",
  furniture: "Furniture and decor",
  plants: "Plants",
  fees: "Design and contingency",
};

// A commercial kitchen (extraction, stainless steel, gas safety) costs about twice a home one; a powder room
// or WC about 45% of a full bathroom.
const BUSINESS_KITCHEN = 2.2;
const HALF_BATH = 0.45;
const PLANT = 120; // per lived-in room, USD at mid retail
const FEES = 0.1;
// Furniture and decor per m2, by room kind, USD at mid-range US retail.
const FURNITURE: Record<string, number> = {
  living: 250, lounge: 250, bedroom: 200, "guest-room": 350, dining: 220, office: 180, workspace: 300, meeting: 350,
  reception: 400, counter: 600, retail: 250, fitting: 150, kitchen: 0, bath: 0, laundry: 40, storage: 40, closet: 120, pantry: 60,
};
// The kitchen rates are for a typical fitted kitchen of about 14 m2 (150 sq ft); a bigger one has more cabinets and
// worktop, a smaller one less, but appliances cost the same, so the price follows the size gently.
const KITCHEN_M2 = 14;
export const kitchenSize = (area: number) => Math.min(1.6, Math.max(0.7, Math.sqrt(area / KITCHEN_M2)));
const NO_PLANTS = new Set(["bath", "storage", "closet", "laundry", "pantry", "corridor", "stairs", "void"]);

/**
 * A market: its currency, the exchange rate from USD (approximate, October 2026), and its retail price level for
 * furniture next to the US ("interiors": a mid-range sofa in India costs about 40% of the US price in dollars).
 * Building and renovation rates come from the market's own research in rates.ts, not from these factors.
 */
export type Market = { id: string; name: string; currency: string; locale: string; fx: number; interiors: number };
export const MARKETS: Market[] = [
  { id: "us", name: "United States", currency: "USD", locale: "en-US", fx: 1, interiors: 1 },
  { id: "ca", name: "Canada", currency: "CAD", locale: "en-CA", fx: 1.37, interiors: 1 },
  { id: "uk", name: "United Kingdom", currency: "GBP", locale: "en-GB", fx: 0.76, interiors: 0.95 },
  { id: "de", name: "Germany", currency: "EUR", locale: "de-DE", fx: 0.88, interiors: 0.95 },
  { id: "au", name: "Australia", currency: "AUD", locale: "en-AU", fx: 1.52, interiors: 1.05 },
  { id: "ae", name: "United Arab Emirates", currency: "AED", locale: "en-AE", fx: 3.67, interiors: 0.95 },
  { id: "sg", name: "Singapore", currency: "SGD", locale: "en-SG", fx: 1.3, interiors: 1 },
  { id: "in", name: "India", currency: "INR", locale: "en-IN", fx: 88, interiors: 0.4 },
];

const PLACES: [RegExp, string][] = [
  [/india|mumbai|delhi|bengaluru|bangalore|pune|hyderabad|chennai|kolkata|noida|gurgaon|gurugram|jaipur|ahmedabad|lucknow|chandigarh|kochi|goa|indore|surat/i, "in"],
  [/\b(uk|united kingdom|england|scotland|wales)\b|london|manchester|birmingham|edinburgh|glasgow|bristol|leeds|liverpool/i, "uk"],
  [/canada|toronto|vancouver|montreal|calgary|ottawa|edmonton/i, "ca"],
  [/australia|sydney|melbourne|brisbane|perth|adelaide|canberra/i, "au"],
  [/\b(uae)\b|emirates|dubai|abu dhabi|sharjah/i, "ae"],
  [/singapore/i, "sg"],
  [/germany|deutschland|berlin|munich|münchen|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf/i, "de"],
];

/** Whether we have costs for this place: a market we know, or the US (a state code like "Austin, TX" or "USA"). */
export const knownMarket = (location: string | null | undefined) =>
  !location || PLACES.some(([re]) => re.test(location)) || /\b(usa?|united states)\b|,\s*[A-Z]{2}\b|\b\d{5}\b/i.test(location);

/** The market a site is in, from its location text. Anywhere else uses US costs, and says so. */
export function marketOf(location: string | null | undefined): Market {
  const id = PLACES.find(([re]) => re.test(location ?? ""))?.[1] ?? "us";
  return MARKETS.find((m) => m.id === id)!;
}

export type Range = { low: number; high: number };
export type Line = { category: Category; amount: number };
export type RoomCost = { id: string; name: string; kind: string; area: number; lines: Line[]; total: number };
export type Estimate = { tier: Tier; market: Market; region: string | null; rooms: RoomCost[]; byCategory: Partial<Record<Category, number>>; total: Range; area: number };

// The range around a point estimate: early estimates run about 20% under to 25% over.
const spread = (v: number): Range => ({ low: v * 0.8, high: v * 1.25 });

/**
 * The estimate for a layout at a tier, in a market and (from `location`) its region. `newBuild` adds the building
 * itself; businesses get commercial kitchens.
 */
export function estimate(layout: Layout, tier: Tier, market: Market, newBuild = false, location?: string | null): Estimate {
  const region = regionOf(location, market.id);
  const r = RATES[market.id][tier];
  const k = region.factor;
  const inside = market.interiors * market.fx * FURNITURE_TIER[tier];
  const home = ["house", "apartment", "studio"].includes(layout.spaceType);
  const rooms: RoomCost[] = [];
  for (const f of layout.floors)
    for (const s of f.spaces.filter((x) => x.kind !== "void")) {
      const area = s.rect.w * s.rect.h;
      // A new build's rate per m2 already covers floors, paint, wiring and bathrooms, so only a fit-out lists them.
      const lines: Line[] = newBuild
        ? []
        : [
            { category: "finishes", amount: area * (r.floor + r.paint) * k },
            { category: "electrical", amount: area * r.power * k },
          ];
      if (s.kind === "kitchen") lines.push({ category: "kitchen", amount: r.kitchen * kitchenSize(area) * (home ? 1 : BUSINESS_KITCHEN) * k });
      if (s.kind === "bath" && !newBuild) lines.push({ category: "bath", amount: r.bath * (/powder|wc|restroom|toilet/i.test(s.name) ? HALF_BATH : 1) * k });
      const furniture = FURNITURE[s.kind] ?? 0;
      if (furniture) lines.push({ category: "furniture", amount: area * furniture * inside });
      if (s.zone !== "circulation" && !NO_PLANTS.has(s.kind)) lines.push({ category: "plants", amount: PLANT * inside });
      rooms.push({ id: s.id, name: s.zone === "circulation" ? s.name || "Halls" : s.name, kind: s.kind, area, lines, total: lines.reduce((a, l) => a + l.amount, 0) });
    }
  const area = rooms.reduce((a, r) => a + r.area, 0);
  const byCategory: Partial<Record<Category, number>> = {};
  for (const r of rooms) for (const l of r.lines) byCategory[l.category] = (byCategory[l.category] ?? 0) + l.amount;
  // The building itself, on the whole floor area.
  if (newBuild) byCategory.construction = area * r.build * k;
  const sub = Object.values(byCategory).reduce((a, v) => a + v, 0);
  byCategory.fees = sub * FEES;
  return { tier, market, region: region.name, rooms, byCategory, total: spread(sub * (1 + FEES)), area };
}

/** "₹18.4L–28.7L", "$84k–132k": rounded, in the market's own way of writing money. */
export function money(v: number, m: Market): string {
  return new Intl.NumberFormat(m.locale, { style: "currency", currency: m.currency, notation: "compact", maximumFractionDigits: 1 }).format(v);
}

// One answer to "at what quality, and is it a new build?" for every screen that shows a cost (budget, Make changes,
// exports, the site, change requests, the home card), so the same project never shows two prices.
type Said = { interview?: Record<string, unknown> | null };

/** The quality they chose in the interview, if they did. */
export const toldTier = (p: Said): Tier | null => {
  const level = (p.interview?.budget as { level?: string } | undefined)?.level;
  return (TIERS as readonly string[]).includes(level ?? "") ? (level as Tier) : null;
};

/** The quality a cost starts at: what they told us, else what their taste suggests, else mid-range. */
export const projectTier = (p: Said, tasteTier: Tier | null = null): Tier => toldTier(p) ?? tasteTier ?? "mid";

/** A new build (the building itself is in the cost) or a fit-out of what's there. */
export const isNewBuild = (p: Said) => (p.interview?.project as { newBuild?: boolean } | undefined)?.newBuild === true;
