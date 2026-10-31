import type { Brand, Evidence, Family, Layer, Profile, StyleTag } from "./types.ts";

// How a description of a look is put to the image-text model: as a picture of a room, which is what photos are.
export const asPrompt = (description: string) => `a photo of an interior with ${description}`;

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
// Words that can't both describe one taste; when both come up, the weaker one goes.
const OPPOSITES: [string, string][] = [
  ["minimalist", "maximalist"],
  ["bright", "moody"],
  ["light_wood", "dark_wood"],
  ["monochrome", "colorful"],
  ["serene", "lively"],
];

export function withoutOpposites(tags: StyleTag[]): StyleTag[] {
  const weight = new Map(tags.map((t) => [t.value, t.weight]));
  const drop = new Set<string>();
  for (const [a, b] of OPPOSITES) if (weight.has(a) && weight.has(b)) drop.add(weight.get(a)! >= weight.get(b)! ? b : a);
  return tags.filter((t) => !drop.has(t.value));
}

export function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// CLIP text vectors all lean one way, so raw similarities to brands bunch up (0.83 to 0.93 for every taste). Measured
// from the catalogue's average instead, they spread out (about -0.15 to 0.2) and an affinity means something.
export const centreOf = (vectors: number[][]) =>
  vectors.length ? vectors[0].map((_, i) => vectors.reduce((s, v) => s + v[i], 0) / vectors.length) : [];
export const minus = (v: number[], centre: number[]) => (centre.length ? v.map((x, i) => x - centre[i]) : v);

// The words one input stands out for, given its similarity to every word, with how far above its average each sits.
export function standoutsOf(sims: number[], words: Pick<WordVector, "family" | "value">[]) {
  const mean = sims.reduce((s, x) => s + x, 0) / sims.length;
  const sd = Math.sqrt(sims.reduce((s, x) => s + (x - mean) ** 2, 0) / sims.length) || 1;
  const scored = words.map((w, i) => ({ word: w, z: (sims[i] - mean) / sd })).filter((x) => x.z >= STANDS_OUT);
  const out: typeof scored = [];
  for (const fam of Object.keys(PER_FAMILY) as Family[])
    out.push(...scored.filter((x) => x.word.family === fam).sort((a, b) => b.z - a.z).slice(0, PER_FAMILY[fam]));
  return out;
}

export const standouts = (vector: number[], words: WordVector[]) => standoutsOf(words.map((w) => cosine(vector, w.vector)), words);

/** The taste as one vector: each input weighted by where it came from. */
export function tasteVector(signals: Signal[]): number[] {
  const taste = new Array(signals[0]?.vector.length ?? 0).fill(0);
  for (const s of signals) s.vector.forEach((x, i) => (taste[i] += x * LAYER_WEIGHT[s.source.layer]));
  return taste;
}

// What the profile is built from, wherever the similarities were worked out (in memory, or by the vector database).
export type Sims = {
  /** For each input, its similarity to every style word, in `words` order. */
  words: number[][];
  /** The brands nearest the whole taste, best first, with their (centred) affinity. */
  nearest: { id: string; name: string; aesthetic: string[]; affinity: number }[];
  /** For each input, its (centred) similarity to each brand, by brand id. */
  brands: Map<string, number>[];
};

/** Pure: the profile from the inputs and their similarities. */
export function profileFrom(signals: Signal[], words: Pick<WordVector, "family" | "value">[], sims: Sims): Profile {
  const byKey = new Map<string, StyleTag>();
  signals.forEach((s, i) => {
    for (const { word, z } of standoutsOf(sims.words[i], words)) {
      const key = `${word.family}:${word.value}`;
      const tag = byKey.get(key) ?? { family: word.family, value: word.value, weight: 0, sources: [] };
      tag.weight += LAYER_WEIGHT[s.source.layer] * z * (FAMILY_WEIGHT[word.family] ?? 1);
      if (!tag.sources.some((e) => e.entityId === s.source.entityId)) tag.sources.push(s.source);
      byKey.set(key, tag);
    }
  });
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  const brands: Brand[] = sims.nearest.map((b) => ({
    id: b.id,
    name: b.name,
    affinity: r3(b.affinity),
    aesthetic: b.aesthetic,
    because: signals.map((s, i) => ({ entityId: s.source.entityId, score: r3(sims.brands[i].get(b.id) ?? 0) })).sort((x, y) => y.score - x.score).slice(0, 2),
  }));
  return { tags: withoutOpposites([...byKey.values()].sort((a, b) => b.weight - a.weight)), brands };
}

/** The profile worked out in memory (the browser, scripts, and the fallback when the vector database is away). */
export function buildProfile(signals: Signal[], words: WordVector[], brands: BrandVector[] = [], takeBrands = 12): Profile {
  if (!signals.length) return { tags: [], brands: [] };
  const centre = centreOf(brands.map((b) => b.vector));
  const centred = brands.map((b) => ({ ...b, vector: minus(b.vector, centre) }));
  const taste = minus(tasteVector(signals), centre);
  return profileFrom(signals, words, {
    words: signals.map((s) => words.map((w) => cosine(s.vector, w.vector))),
    nearest: centred
      .map((b) => ({ id: b.id, name: b.name, aesthetic: b.aesthetic, affinity: cosine(taste, b.vector) }))
      .sort((x, y) => y.affinity - x.affinity)
      .slice(0, takeBrands),
    brands: signals.map((s) => new Map(centred.map((b) => [b.id, cosine(minus(s.vector, centre), b.vector)]))),
  });
}
