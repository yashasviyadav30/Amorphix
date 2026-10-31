import { test } from "node:test";
import assert from "node:assert/strict";
import { cardWords, missingForDesign, profileSummary, siteSizeProblem, toCandidate, toMetres } from "./logic.ts";
import type { Project } from "../project/store.ts";
import type { Profile } from "../qloo/taste.ts";

const project = (over: Partial<Project> = {}): Project => ({
  id: "p", owner_id: null, guest_id: null, mode: "owner", space_type: null, title: null, status: "interview",
  site: {}, interview: {}, taste_signals: [], taste: null, brief: null, program: null, chosen_option: null, ...over,
});

test("feet convert to metres", () => {
  assert.equal(toMetres(10, "m"), 10);
  assert.ok(Math.abs(toMetres(40, "ft") - 12.192) < 1e-9);
});

test("candidates describe the match in plain words", () => {
  const c = toCandidate({ entity_id: "e", name: "A hotel", types: ["urn:entity:place"], properties: { address: "1 Main St, Austin" } });
  assert.deepEqual(c, { entityId: "e", name: "A hotel", kind: "place", detail: "1 Main St, Austin", layer: 1 });
  assert.equal(toCandidate({ entity_id: "f", name: "A film", types: ["urn:entity:movie"] }).kind, "film");
  assert.equal(toCandidate({ entity_id: "x", name: "?", types: [] }).kind, "other");
});

test("a fresh project is missing everything", () => {
  assert.equal(missingForDesign(project()).length, 5);
});

test("a complete project is ready", () => {
  const ready = project({
    space_type: "house",
    site: { width: 14, depth: 10, location: "Austin, TX" },
    interview: { living: { kitchen: "open", bedrooms: "apart" } },
    taste_signals: [
      { entityId: "a", name: "A", layer: 1 },
      { entityId: "b", name: "B", layer: 3 },
      { entityId: "c", name: "C", layer: 3 },
    ],
  });
  assert.deepEqual(missingForDesign(ready), []);
});

test("culture alone is not enough taste", () => {
  const onlyFilms = project({
    space_type: "house",
    site: { width: 14, depth: 10, location: "Austin" },
    taste_signals: ["a", "b", "c"].map((id) => ({ entityId: id, name: id, layer: 3 as const })),
    interview: { living: { kitchen: "open", bedrooms: "together" } },
  });
  assert.deepEqual(missingForDesign(onlyFilms), ["at least one place or brand they love"]);
});

test("a home also needs to know how they live in it", () => {
  const noLiving = project({
    space_type: "house",
    site: { width: 14, depth: 10, location: "Austin" },
    taste_signals: [{ entityId: "a", name: "A", layer: 1 }, { entityId: "b", name: "B", layer: 2 }, { entityId: "c", name: "C", layer: 3 }],
  });
  assert.equal(missingForDesign(noLiving).length, 1);
  assert.match(missingForDesign(noLiving)[0], /kitchen/);
  // A café isn't asked about kitchens at home: it's asked how it runs, and is ready once it has said.
  const cafe = { ...noLiving, space_type: "cafe" as const };
  assert.equal(missingForDesign(cafe).length, 1);
  assert.match(missingForDesign(cafe)[0], /how they run it: whether most customers sit down/);
  assert.deepEqual(missingForDesign({ ...cafe, interview: { running: { service: "takeaway", kitchen: "prep" } } }), []);
  assert.deepEqual(missingForDesign({ ...noLiving, space_type: "studio", interview: { living: { kitchen: "open", bedrooms: "together" } } }), []);
});

test("the summary keeps the strongest words and their sources", () => {
  const profile: Profile = {
    tags: [
      { family: "decor", value: "post_industrial", weight: 3, sources: [{ entityId: "a", name: "A hotel", layer: 1 }] },
      { family: "ambience", value: "moody", weight: 2, sources: [{ entityId: "a", name: "A hotel", layer: 1 }] },
    ],
    brands: [{ id: "b", name: "A brand", affinity: 0.9, aesthetic: ["clean_lines", "natural_materials"], because: [] }],
  };
  const s = profileSummary(profile, 1);
  assert.deepEqual(s.style, [{ word: "post industrial", from: ["A hotel"] }]);
  assert.deepEqual(s.brands, [{ name: "A brand", look: ["clean lines", "natural materials"] }]);
});

test("site sizes outside a studio-to-hotel range are refused", () => {
  assert.equal(siteSizeProblem(8, 6, "m"), null); // small studio
  assert.equal(siteSizeProblem(40, 60, "ft"), null); // typical US lot
  assert.equal(siteSizeProblem(undefined, undefined, "ft"), null);
  assert.match(siteSizeProblem(10000, 60, "ft")!, /width of 10000 ft/);
  assert.match(siteSizeProblem(40, 3, "m")!, /depth of 3 m/);
  assert.match(siteSizeProblem(15, 15, "ft")!, /width of 15 ft/); // 4.6 m is too small for any room pair
});

test("a size as people say it gives width and depth, keeping what the model already sent", async () => {
  const { sizeFrom } = await import("./logic.ts");
  assert.deepEqual(sizeFrom("40 by 30 feet"), { width: 40, depth: 30, unit: "ft" });
  assert.deepEqual(sizeFrom("12x9 m"), { width: 12, depth: 9, unit: "m" });
  assert.deepEqual(sizeFrom("30 ft × 40 ft"), { width: 30, depth: 40, unit: "ft" });
  assert.equal(sizeFrom("11 by 8 metres", 11).unit, "m", "the user's unit beats the model's guess");
  assert.deepEqual(sizeFrom("40 by 30", 40), { width: 40, depth: 30 }, "the depth the model dropped");
  assert.deepEqual(sizeFrom(undefined, 12, 10), { width: 12, depth: 10 });
  assert.deepEqual(sizeFrom("a big plot"), { width: undefined, depth: undefined });
});

test("the taste card shows each word once, even when Qloo gives it as both decor and ambience", () => {
  const src = [{ entityId: "a", name: "A hotel", layer: 1 as const }];
  const profile = {
    tags: [
      { family: "decor" as const, value: "elegant", weight: 2, sources: src },
      { family: "ambience" as const, value: "elegant", weight: 1.5, sources: src },
      { family: "decor" as const, value: "modern", weight: 1, sources: src },
    ],
    brands: [],
  };
  assert.deepEqual(profileSummary(profile).style.map((s) => s.word), ["elegant", "modern"]);
});

test("the style card's words: strongest first, each once, at most three from any one pick", () => {
  const a: { entityId: string; name: string; layer: 1 | 2 }[] = [{ entityId: "a", name: "A hotel", layer: 1 }];
  const b = [{ entityId: "b", name: "A brand", layer: 2 as const }];
  const tag = (family: "decor" | "ambience" | "aesthetic" | "tone", value: string, weight: number, sources = a) => ({ family, value, weight, sources });
  const profile = { tags: [tag("decor", "vintage", 9), tag("ambience", "vintage", 8), tag("decor", "eclectic", 7), tag("ambience", "moody", 6), tag("decor", "artsy", 5), tag("tone", "warm", 4), tag("aesthetic", "clean lines", 3, b)], brands: [] };
  assert.deepEqual(cardWords(profile).map((w) => `${w.word}/${w.from}`), ["vintage/A hotel", "eclectic/A hotel", "moody/A hotel", "clean lines/A brand"]);
});
