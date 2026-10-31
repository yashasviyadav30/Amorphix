import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProfile, cosine, standouts, withoutOpposites, type WordVector } from "./engine.ts";

// Synthetic vectors: each style word points along its own axis, so an input close to an axis stands out for that word.
const axis = (i: number, n = 8, w = 1) => Array.from({ length: n }, (_, k) => (k === i ? w : 0.05));
const words: WordVector[] = [
  { family: "decor", value: "industrial", vector: axis(0) },
  { family: "decor", value: "scandinavian", vector: axis(1) },
  { family: "ambience", value: "cozy", vector: axis(2) },
  { family: "ambience", value: "bright", vector: axis(3) },
  { family: "aesthetic", value: "brass_accents", vector: axis(4) },
  { family: "tone", value: "warm", vector: axis(5) },
  { family: "decor", value: "bohemian", vector: axis(6) },
  { family: "aesthetic", value: "concrete", vector: axis(7) },
];
const photo = (name: string, v: number[]) => ({ source: { entityId: `photo-${name}`, name, layer: 1 as const }, vector: v });

test("cosine is 1 for the same direction and 0 for none", () => {
  assert.equal(Math.round(cosine([1, 2], [2, 4]) * 1000) / 1000, 1);
  assert.equal(cosine([0, 0], [1, 1]), 0);
});

test("an input stands out for the words it points at, not the rest", () => {
  const v = axis(0); v[7] = 0.9;
  const got = standouts(v, words).map((x) => x.word.value);
  assert.ok(got.includes("industrial") && got.includes("concrete"));
  assert.ok(!got.includes("scandinavian"));
});

test("every tag names the photo or love it came from, strongest first", () => {
  const loft = axis(0); loft[7] = 0.8;
  const p = buildProfile([photo("Your photo 1", loft), photo("Your photo 2", axis(0))], words);
  assert.equal(p.tags[0].value, "industrial");
  assert.deepEqual(p.tags[0].sources.map((s) => s.name), ["Your photo 1", "Your photo 2"]);
  for (let i = 1; i < p.tags.length; i++) assert.ok(p.tags[i - 1].weight >= p.tags[i].weight);
});

test("a photo outweighs a film for the same word", () => {
  const film = { source: { entityId: "f", name: "A film", layer: 3 as const }, vector: axis(1) };
  const p = buildProfile([photo("Your photo", axis(0)), film], words);
  const w = (v: string) => p.tags.find((t) => t.value === v)!.weight;
  assert.ok(w("industrial") > w("scandinavian"));
});

test("brands are ranked by how close they sit to the whole taste, with the inputs that brought them", () => {
  const brands = [
    { id: "b1", name: "Loft & Steel", aesthetic: ["industrial"], vector: axis(0) },
    { id: "b2", name: "Nordic Home", aesthetic: ["scandinavian"], vector: axis(1) },
  ];
  const p = buildProfile([photo("Your photo", axis(0))], words, brands);
  assert.equal(p.brands[0].name, "Loft & Steel");
  assert.equal(p.brands[0].because[0].entityId, "photo-Your photo");
});

test("no inputs give an empty profile", () => {
  assert.deepEqual(buildProfile([], words, []), { tags: [], brands: [] });
});

test("of two opposite words, only the stronger stays", () => {
  const t = (value: string, weight: number) => ({ family: "decor" as const, value, weight, sources: [] });
  const kept = withoutOpposites([t("minimalist", 9), t("industrial", 5), t("maximalist", 2)]).map((x) => x.value);
  assert.deepEqual(kept, ["minimalist", "industrial"]);
  assert.deepEqual(withoutOpposites([t("bright", 1), t("moody", 4)]).map((x) => x.value), ["moody"]);
});

test("calibrated, a word every description sits close to loses to the one this name really points at; a photo is read as it is", () => {
  const v = axis(0, 8, 1); v[1] = 0.9;
  const calibration = { words: words.map((w) => ({ value: w.value, mu: w.value === "industrial" ? 0.7 : 0.1, sd: 0.1 })), brands: [] };
  const name = { source: { entityId: "name:a", name: "A", layer: 1 as const }, vector: v };
  assert.equal(buildProfile([name], words, [], 12, calibration).tags[0].value, "scandinavian");
  assert.equal(buildProfile([name], words).tags[0].value, "industrial");
  assert.equal(buildProfile([photo("P", v)], words, [], 12, calibration).tags[0].value, "industrial");
});

test("calibrated, brands are ranked by how far above their usual level they sit", () => {
  const brands = [
    { id: "broad", name: "Broad", aesthetic: [], vector: axis(0) },
    { id: "niche", name: "Niche", aesthetic: [], vector: axis(1) },
    { id: "other", name: "Other", aesthetic: [], vector: axis(2) },
  ];
  const v = axis(0, 8, 1); v[1] = 0.8;
  const name = { source: { entityId: "name:a", name: "A", layer: 1 as const }, vector: v };
  const calibration = { words: [], brands: [{ id: "broad", mu: 0.6, sd: 0.1 }, { id: "niche", mu: -0.2, sd: 0.1 }, { id: "other", mu: 0, sd: 0.1 }] };
  assert.equal(buildProfile([name], words, brands).brands[0].id, "broad");
  assert.equal(buildProfile([name], words, brands, 12, calibration).brands[0].id, "niche");
});
