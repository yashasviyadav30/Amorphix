import { entitiesById, homeBrands, type Entity } from "./api.ts";
import { buildProfile, type Profile } from "./taste.ts";
import type { TasteSignal } from "../project/store.ts";

/**
 * The style profile for what someone loves: places and brands give their own tags, films and music reach home
 * brands through Qloo insights. `known` holds entities already in hand; any other place or brand is looked up.
 */
export async function profileFor(signals: TasteSignal[], known: Map<string, Entity> = new Map()): Promise<Profile> {
  const missing = signals.filter((s) => s.layer !== 3 && !known.has(s.entityId)).map((s) => s.entityId);
  for (const e of await entitiesById(missing)) known.set(e.entity_id, e);
  const liked = signals.filter((s) => s.layer !== 3 && known.has(s.entityId)).map((s) => ({ entity: known.get(s.entityId)!, layer: s.layer as 1 | 2 }));
  return buildProfile(liked, await homeBrands(signals.filter((s) => s.layer === 3).map((s) => s.entityId)));
}
