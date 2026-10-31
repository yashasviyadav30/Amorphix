import type { Tier } from "./costs.ts";

// Renovation and building rates for each market Amorphix prices, for each quality tier, in local currency,
// researched October 2026 from published 2025-26 cost guides. Most guides publish budget, mid-range and
// high-end bands: essential is the budget band, mid the mid-range band, premium the high-end band and luxury the
// top of the published range (bespoke, imported, designer). Where no guide gave a figure, it is derived from the
// market's other trades and marked "derived". These are planning estimates, not quotes; the budget page shows a
// range around them.
//
// floor:   flooring supplied and fitted, per m2 of floor
// paint:   walls and ceilings painted, per m2 of floor
// power:   wiring, sockets and lighting points, per m2 of floor
// kitchen: a fitted home kitchen with appliances; bath: a full bathroom refit
// build:   building a new house, per m2 of floor, before land

export type Rates = { floor: number; paint: number; power: number; kitchen: number; bath: number; build: number };
type Market = Record<Tier, Rates> & { sources: string[] };

const t = (essential: number, mid: number, premium: number, luxury: number) => ({ essential, mid, premium, luxury });
/** Builds a market's table from one row per trade, each [essential, mid, premium, luxury]. */
function market(rows: Record<keyof Rates, ReturnType<typeof t>>, sources: string[]): Market {
  const at = (tier: Tier): Rates => ({
    floor: rows.floor[tier], paint: rows.paint[tier], power: rows.power[tier],
    kitchen: rows.kitchen[tier], bath: rows.bath[tier], build: rows.build[tier],
  });
  return { essential: at("essential"), mid: at("mid"), premium: at("premium"), luxury: at("luxury"), sources };
}

export const RATES: Record<string, Market> = {
  // USD
  us: market(
    {
      floor: t(45, 100, 180, 300), // LVT/laminate ~$4/sq ft; engineered hardwood $7-20 (Angi); exotic $13-30 (Inch Calculator)
      paint: t(22, 38, 54, 75), // $2-6/sq ft incl. materials; $4.70 with trim and ceilings (HomeAdvisor 2025)
      power: t(22, 54, 86, 130), // rewiring $2-4/sq ft (Bankrate, quoting Angi) to $6-10 (Angi); smart lighting at the top
      kitchen: t(15000, 28500, 78000, 150000), // budget $15k; midrange minor $28.5k; midrange major ~$80k; upscale Pacific $165k (Cost vs Value)
      bath: t(6600, 12100, 25000, 50000), // $6.6k-17.6k, average $12.1k (Chase 2025); upscale $45k-70k
      build: t(1400, 2050, 3000, 4850), // $100-155/sq ft by region (HomeGuide) to $150-280 (builders); custom $450/sq ft
    },
    ["Remodeling Cost vs Value", "Angi", "HomeAdvisor 2025", "Bankrate/HomeGuide 2025", "Chase 2025", "Inch Calculator 2025"],
  ),
  // GBP
  uk: market(
    {
      floor: t(40, 95, 135, 200), // laminate ~£40; engineered wood £60-135 fitted (MyBuilder, MyJobQuote 2026)
      paint: t(35, 50, 70, 100), // room £300-700; 3-bed house £3k-7k (MyBuilder, Fantastic Services 2026)
      power: t(50, 70, 95, 130), // 3-bed rewire £4.5k-8k over ~90 m2; London +15-30% (2025-26 guides)
      kitchen: t(11000, 18000, 35000, 60000), // budget £6.2k-16.8k, mid £11.5k-35k, bespoke £15k-50k+ (Checkatrade 2026)
      bath: t(4500, 7000, 11000, 20000), // average ~£7,000, range £4.5k-11k (Checkatrade 2025)
      build: t(1500, 2300, 3000, 4000), // basic £1,500, standard £2,000, good £2,500, excellent £3,500/m2 (UK calculators 2025)
    },
    ["Checkatrade 2025-26", "MyBuilder", "MyJobQuote 2026", "Fantastic Services 2026", "self-build.co.uk 2026"],
  ),
  // CAD
  ca: market(
    {
      floor: t(50, 108, 175, 250), // hardwood C$4-20/sq ft installed (HomeStars, Wealthnorth)
      paint: t(30, 52, 74, 103), // derived from US rates at the CAD exchange rate
      power: t(70, 100, 140, 200), // whole-home rewire C$10k-30k+, Toronto (electrician guides); C$100-160/h
      kitchen: t(20000, 40000, 75000, 120000), // basic C$15k-25k, mid C$30k-55k, high-end C$60k-100k+ (Toronto 2025)
      bath: t(12000, 18000, 30000, 50000), // C$10k-30k; Toronto refresh C$12k-19.5k (HomeStars, 2025 guides)
      build: t(2400, 3630, 4570, 5800), // Ontario custom: standard C$300-375, premium C$375-475, luxury C$475-600+/sq ft
    },
    ["HomeStars", "Altus Group Canadian Cost Guide 2025", "Ontario builder cost guide 2026", "Green Building Canada"],
  ),
  // AUD
  au: market(
    {
      floor: t(60, 110, 170, 250), // flooring A$46-112/m2; timber A$80-250/m2 installed (2025 guides)
      paint: t(25, 40, 55, 80), // A$18-30/m2 of wall; 3-bed interior A$3.5k-8k (OpenAgent, Painting Pages 2025)
      power: t(50, 70, 100, 140), // derived from renovation rates
      kitchen: t(20000, 35000, 55000, 100000), // budget A$15k-25k, mid A$25k-45k, Sydney A$35k-60k, high-end A$50k-120k
      bath: t(15000, 26000, 38000, 60000), // mid A$20k-35k, average ~A$26k; Melbourne family A$24k-38k
      build: t(1600, 2400, 3300, 4500), // project home A$1,600-2,700, custom A$2,700-3,900+/m2 (DuoTax 2025)
    },
    ["What's The Damage 2026", "Three Birds Renovations 2026", "DuoTax 2025", "OpenAgent 2025", "Budget Direct"],
  ),
  // EUR
  de: market(
    {
      floor: t(40, 75, 120, 180), // parquet €30-150/m2, €70-180 with fitting (MyHammer, Aroundhome 2025-26)
      paint: t(15, 25, 35, 50), // painter €5-15/m2 of wall (MyHammer), about 2.5 m2 of wall per m2 of floor
      power: t(50, 80, 120, 175), // electrics and plumbing together €100-350/m2 (MyHammer); about half is electrical
      kitchen: t(6000, 12000, 20000, 35000), // AMK average €9,200 (2025) to €12,400 (2026); mid €8k-15k fitted
      bath: t(9000, 20000, 28000, 45000), // partial €5k-12k, full €15k-30k plus VAT (2025 guides)
      build: t(1800, 3000, 3600, 4500), // €1,800-3,500/m2 (VPB), average house €3,360-3,600 (2025 guides)
    },
    ["Arbeitskreis Die Moderne Küche (AMK)", "MyHammer 2026", "Verband privater Bauherren (VPB)", "Volksbanken Raiffeisenbanken"],
  ),
  // AED
  ae: market(
    {
      floor: t(100, 225, 350, 500), // ceramic AED 50-150, wood AED 150-300, marble AED 300-700/m2 (Bayut)
      paint: t(15, 25, 40, 60), // derived; a 4-bed villa repaint is about AED 3,000 (ServiceMarket)
      power: t(50, 80, 120, 180), // derived
      kitchen: t(35000, 75000, 120000, 200000), // basic AED 20k-50k, mid AED 50k-120k, luxury AED 120k-250k+ (Bayut)
      bath: t(20000, 40000, 70000, 110000), // small AED 10k-30k, medium AED 30k-70k, high-end AED 70k-150k+ (Bayut)
      build: t(3230, 4200, 7000, 10760), // standard villa ~AED 390/sq ft, high-end ~AED 1,020 (Knight Frank Q2 2025)
    },
    ["Bayut", "Property Finder", "Knight Frank Q2 2025 via Engel & Völkers", "ServiceMarket"],
  ),
  // SGD
  sg: market(
    {
      floor: t(43, 108, 200, 400), // vinyl S$3-8 psf, parquet S$8-100+ psf (MoneySmart)
      paint: t(15, 20, 35, 60), // whole flat S$1,000-1,700 (99.co) to S$8,000 extensive (MoneySmart)
      power: t(35, 55, 80, 120), // HDB rewire S$3k-7.5k by flat size (2025-26 electrician guides)
      kitchen: t(9000, 15000, 23000, 40000), // S$8.9k-23.2k (MoneySmart); up to S$70k for bespoke
      bath: t(3500, 7000, 12000, 20000), // basic S$3k-5k, extensive S$6k-9k (Qanvast via MoneySmart)
      build: t(3230, 4300, 5380, 7500), // landed new build S$300-500 psf, luxury above (EdgeProp 2025)
    },
    ["MoneySmart 2026", "Qanvast", "99.co", "EdgeProp 2025", "Homejourney 2025"],
  ),
  // INR
  in: market(
    {
      floor: t(860, 1615, 3230, 5380), // vitrified ₹70-150/sq ft, wood ₹150-500/sq ft
      paint: t(430, 650, 970, 1400), // ₹40-100/sq ft of wall treatments
      power: t(750, 1075, 1615, 2370), // derived: ₹70-220 per sq ft of floor from basic to smart wiring
      kitchen: t(120000, 250000, 450000, 800000), // 10x10 ₹1.2-3.5 lakh; modular ₹2-8 lakh (2025 guides)
      bath: t(60000, 150000, 300000, 500000), // ₹50k-2.5 lakh; standard remodel ₹2-5 lakh (2025 guides)
      build: t(17220, 24750, 32300, 43000), // basic ₹1,500-2,000, mid ₹1,800-2,800, premium ₹2,800-3,500+/sq ft
    },
    ["BeyondWalls 2025", "JK Cement 2026", "Housiey 2026", "AECORD 2026", "Indian interior firms' 2025-26 guides"],
  ),
};

/** Within a market, how much a region's work costs next to the market's middle. */
const REGIONS: Record<string, [RegExp, string, number][]> = {
  us: [
    // HomeGuide new-build $/sq ft by Census region: Northeast $155, West $131, Midwest $109, South $100
    [/,\s*(ME|NH|VT|MA|RI|CT|NY|NJ|PA)\b|new york|boston|philadelphia/i, "Northeast", 1.25],
    [/,\s*(WA|OR|CA|NV|ID|MT|WY|UT|CO|AZ|NM|AK|HI)\b|seattle|portland|san francisco|los angeles|san diego|denver/i, "West", 1.06],
    [/,\s*(OH|MI|IN|IL|WI|MN|IA|MO|ND|SD|NE|KS)\b|chicago|detroit|minneapolis/i, "Midwest", 0.88],
    [/,\s*(DE|MD|DC|VA|WV|NC|SC|GA|FL|KY|TN|AL|MS|AR|LA|OK|TX)\b|austin|houston|dallas|atlanta|miami/i, "South", 0.81],
  ],
  uk: [
    // Midlands baseline; London +30%, South East +15%, North and Scotland -10% (UK build calculators 2025)
    [/london/i, "London", 1.3],
    [/brighton|oxford|reading|guildford|kent|surrey|sussex|south east/i, "South East", 1.15],
    [/manchester|leeds|liverpool|newcastle|sheffield|scotland|edinburgh|glasgow|north/i, "North and Scotland", 0.9],
  ],
  in: [
    // Mumbai and Bengaluru run 20-30% above Pune, Hyderabad and Chennai (cost benchmarks 2025-26)
    [/mumbai|navi mumbai|thane/i, "Mumbai", 1.3],
    [/delhi|noida|gurgaon|gurugram|ncr/i, "Delhi NCR", 1.1],
    [/bengaluru|bangalore/i, "Bengaluru", 1.1],
    [/pune|hyderabad|chennai/i, "Pune, Hyderabad and Chennai", 0.9],
  ],
  ca: [
    // Electricians C$100-160/h in Toronto, Vancouver and Calgary; C$80-130 in mid-size cities (HomeStars 2026)
    [/toronto|vancouver|calgary/i, "Toronto, Vancouver and Calgary", 1.1],
  ],
  au: [[/sydney/i, "Sydney", 1.08]], // Sydney is the dearest city per m2, Melbourne close behind (2026 guides)
  de: [
    // Munich ~$6,630/m2 against a German average of ~$5,550 in the civils.ai 2026 benchmarks
    [/munich|münchen/i, "Munich", 1.19],
  ],
};

/** The region a location is in, and its cost factor; the market's middle when no region matches. */
export function regionOf(location: string | null | undefined, marketId: string): { name: string | null; factor: number } {
  const hit = (REGIONS[marketId] ?? []).find(([re]) => re.test(location ?? ""));
  return hit ? { name: hit[1], factor: hit[2] } : { name: null, factor: 1 };
}
