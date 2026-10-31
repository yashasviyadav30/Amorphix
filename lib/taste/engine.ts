import type { Brand, Evidence, Family, Layer, Profile, StyleTag } from "./types.ts";

// Amorphix's taste engine. Every photo and every name a person loves is a vector in the same space as the style words
// (CLIP image and text embeddings). For each one, the words that stand out from the rest (by how many standard
// deviations they sit above that input's average similarity) become style tags, weighted by how strong the signal is
// and where it came from. Pure: the vectors come in, the profile goes out.

export type Signal = { source: Evidence; vector: number[] };
export type WordVector = { family: Family; value: string; vector: number[] };
export type BrandVector = { id: string; name: string; aesthetic: string[]; vector: number[] };

// A photo or a place they love says the most about a space, a brand a little less, a film or song the least.
const LAYER_WEIGHT: Record<Layer, number> = { 1: 3, 2: 2, 3: 1 };
// Emotional tones are broad; they inform the mood but shouldn't lead the style.
const FAMILY_WEIGHT: Partial<Record<Family, number>> = { tone: 0.5 };
// How many words each input may give, per family, and how far above its average a word must stand.
const PER_FAMILY: Record<Family, number> = { decor: 3, aesthetic: 3, ambience: 3, tone: 1, style: 2 };
const STANDS_OUT = 1;

export function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// The words one input stands out for, with how far above its average each sits.
export function standouts(vector: number[], words: WordVector[]) {
  const sims = words.map((w) => cosine(vector, w.vector));
  const mean = sims.reduce((s, x) => s + x, 0) / sims.length;
  const sd = Math.sqrt(sims.reduce((s, x) => s + (x - mean) ** 2, 0) / sims.length) || 1;
  const scored = words.map((w, i) => ({ word: w, z: (sims[i] - mean) / sd })).filter((x) => x.z >= STANDS_OUT);
  const out: typeof scored = [];
  for (const fam of Object.keys(PER_FAMILY) as Family[])
    out.push(...scored.filter((x) => x.word.family === fam).sort((a, b) => b.z - a.z).slice(0, PER_FAMILY[fam]));
  return out;
}

export function buildProfile(signals: Signal[], words: WordVector[], brands: BrandVector[] = [], takeBrands = 12): Profile {
  const byKey = new Map<string, StyleTag>();
  for (const s of signals)
    for (const { word, z } of standouts(s.vector, words)) {
      const key = `${word.family}:${word.value}`;
      const tag = byKey.get(key) ?? { family: word.family, value: word.value, weight: 0, sources: [] };
      tag.weight += LAYER_WEIGHT[s.source.layer] * z * (FAMILY_WEIGHT[word.family] ?? 1);
      if (!tag.sources.some((e) => e.entityId === s.source.entityId)) tag.sources.push(s.source);
      byKey.set(key, tag);
    }

  // The taste as one vector, each input weighted by where it came from; brands are ranked by how close they sit to it.
  const dims = signals[0]?.vector.length ?? 0;
  const taste = new Array(dims).fill(0);
  for (const s of signals) s.vector.forEach((x, i) => (taste[i] += x * LAYER_WEIGHT[s.source.layer]));
  const ranked: Brand[] = dims
    ? brands
        .map((b) => ({ b, affinity: cosine(taste, b.vector) }))
        .sort((x, y) => y.affinity - x.affinity)
        .slice(0, takeBrands)
        .map(({ b, affinity }) => ({
          id: b.id,
          name: b.name,
          affinity: Math.round(affinity * 1000) / 1000,
          aesthetic: b.aesthetic,
          because: signals.map((s) => ({ entityId: s.source.entityId, score: Math.round(cosine(s.vector, b.vector) * 1000) / 1000 })).sort((x, y) => y.score - x.score).slice(0, 2),
        }))
    : [];

  return { tags: [...byKey.values()].sort((a, b) => b.weight - a.weight), brands: ranked };
}
