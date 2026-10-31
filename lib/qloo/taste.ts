import { tagId, type Entity } from "./api.ts";
import { isComplaint } from "./words.ts";

// The taste engine has three layers, strongest first:
//   1. places the user loves (hotels, cafés, restaurants) carry decor and ambience tags directly;
//   2. brands the user loves carry aesthetic and emotional-tone tags;
//   3. culture the user loves (films, music, books) reaches home brands through Qloo insights.
export type Layer = 1 | 2 | 3;
const LAYER_WEIGHT: Record<Layer, number> = { 1: 3, 2: 2, 3: 1 };
// All layer-3 brands together weigh about as much as one place the user named, so many matches can't drown it.
const LAYER3_BUDGET = 3;
// Emotional tones (warm, sophisticated) are broad; they inform mood but shouldn't lead the style.
const FAMILY_WEIGHT: Record<string, number> = { tone: 0.5 };

const FAMILIES = {
  "urn:tag:decor:qloo:": "decor",
  "urn:tag:ambience:qloo:": "ambience",
  "urn:tag:aesthetic_property:qloo:": "aesthetic",
  "urn:tag:emotional_tone:qloo:": "tone",
  "urn:tag:style:qloo:": "style",
} as const;
export type Family = (typeof FAMILIES)[keyof typeof FAMILIES];

export type Evidence = { entityId: string; name: string; layer: Layer };
export type StyleTag = { family: Family; value: string; weight: number; sources: Evidence[] };
export type Profile = { tags: StyleTag[]; brands: { id: string; name: string; affinity: number; aesthetic: string[]; because: { entityId: string; score: number }[] }[] };


function family(id: string): [Family, string] | null {
  for (const [prefix, fam] of Object.entries(FAMILIES)) if (id.startsWith(prefix)) return [fam, id.slice(prefix.length)];
  return null;
}

// Pure: turns resolved entities into one weighted style profile. `matched` are layer-3 brands from Qloo insights.
export function buildProfile(liked: { entity: Entity; layer: 1 | 2 }[], matched: Entity[]): Profile {
  const byKey = new Map<string, StyleTag>();
  const add = (e: Entity, layer: Layer, scale: number) => {
    for (const t of e.tags ?? []) {
      const f = family(tagId(t));
      if (!f || isComplaint(f[1])) continue;
      const key = f.join(":");
      const tag = byKey.get(key) ?? { family: f[0], value: f[1], weight: 0, sources: [] };
      tag.weight += LAYER_WEIGHT[layer] * scale * (FAMILY_WEIGHT[f[0]] ?? 1);
      if (!tag.sources.some((s) => s.entityId === e.entity_id)) tag.sources.push({ entityId: e.entity_id, name: e.name, layer });
      byKey.set(key, tag);
    }
  };
  for (const { entity, layer } of liked) add(entity, layer, 1);
  const total = matched.reduce((t, b) => t + (b.query?.affinity ?? 0.5), 0);
  for (const b of matched) add(b, 3, (LAYER3_BUDGET * (b.query?.affinity ?? 0.5)) / total);

  return {
    tags: [...byKey.values()].sort((a, b) => b.weight - a.weight),
    brands: matched.map((b) => ({
      id: b.entity_id,
      name: b.name,
      affinity: b.query?.affinity ?? 0,
      aesthetic: (b.tags ?? []).map(tagId).filter((id) => id.startsWith("urn:tag:aesthetic_property:qloo:")).map((id) => id.split(":").pop()!),
      because: (b.query?.explainability?.["signal.interests.entities"] ?? []).map((x) => ({ entityId: x.entity_id, score: x.score })),
    })),
  };
}

// Which layer a liked entity feeds, from its Qloo type.
export function layerOf(e: Entity): Layer {
  const types = e.types ?? [];
  if (types.includes("urn:entity:place") || types.includes("urn:entity:destination")) return 1;
  if (types.includes("urn:entity:brand")) return 2;
  return 3;
}
