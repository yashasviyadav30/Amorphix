import { entitiesById, tagId, type Entity } from "../qloo/api.ts";
import type { TasteSignal } from "../project/store.ts";
import { TIERS, type Tier } from "./costs.ts";

// The quality tier a budget starts at, read from the price of what they love: a 4-star hotel, a $$$ brand, a
// moderately priced café. Only things they named count; a brand Qloo matched says nothing about their wallet.

export type PriceSignal = { name: string; level: 1 | 2 | 3 | 4; says: string };
type Props = { price_level?: number; hotel_class?: number };

const WORDS = ["inexpensive", "moderately priced", "pricey", "very expensive"];
const clamp = (n: number) => Math.min(4, Math.max(1, Math.round(n))) as 1 | 2 | 3 | 4;

/** What one entity says about price, if anything. */
export function priceOf(e: Entity): PriceSignal | null {
  const p = (e.properties ?? {}) as Props;
  if (typeof p.hotel_class === "number" && p.hotel_class > 0) {
    return { name: e.name, level: clamp(p.hotel_class - 1), says: `a ${p.hotel_class}-star hotel` };
  }
  if (typeof p.price_level === "number" && p.price_level > 0) {
    const level = clamp(p.price_level);
    return { name: e.name, level, says: WORDS[level - 1] };
  }
  const tag = e.tags?.map((t) => ({ id: tagId(t), name: t.name ?? "" })).find((t) => t.id.startsWith("urn:tag:price_level:"));
  const dollars = tag ? (tag.name || tag.id.split(":").pop() || "").match(/^\$+$/)?.[0].length : undefined;
  if (dollars) {
    const level = clamp(dollars);
    return { name: e.name, level, says: `a ${"$".repeat(level)} brand` };
  }
  return null;
}

/** Pure: the tier from price signals (their average level), with the signals behind it. */
export function tierFrom(signals: PriceSignal[]): { tier: Tier; signals: PriceSignal[] } {
  if (!signals.length) return { tier: "mid", signals };
  const avg = signals.reduce((a, s) => a + s.level, 0) / signals.length;
  return { tier: TIERS[clamp(avg) - 1], signals };
}

/** Looks up what they love in Qloo (one cached call) and reads the tier from it. */
export async function tasteTier(loved: TasteSignal[]): Promise<{ tier: Tier; signals: PriceSignal[] }> {
  const ids = loved.filter((s) => s.layer !== 3).map((s) => s.entityId);
  const found = await entitiesById(ids);
  return tierFrom(found.map(priceOf).filter((s): s is PriceSignal => s !== null));
}
