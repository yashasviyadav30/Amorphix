import { test } from "node:test";
import assert from "node:assert/strict";
import { decorTags, tiles } from "./moodboard.ts";
import type { Entity } from "../qloo/api.ts";
import type { Profile } from "../qloo/taste.ts";

// Synthetic: a hotel and a film they love, two matched brands (one an app), and places elsewhere.
const img = (id: string) => ({ image: { url: `https://img.test/${id}.jpg` } });
const p = {
  taste_signals: [
    { entityId: "hotel", name: "A Hotel", layer: 1 as const },
    { entityId: "film", name: "A Film", layer: 3 as const, type: "urn:entity:movie" },
  ],
  taste: {
    tags: [
      { family: "decor", value: "vintage", weight: 3, sources: [{ entityId: "hotel", name: "A Hotel", layer: 1 }] },
      { family: "decor", value: "glossy", weight: 9, sources: [{ entityId: "lamp", name: "Lamp Co", layer: 3 }] },
      { family: "decor", value: "eclectic", weight: 2, sources: [{ entityId: "hotel", name: "A Hotel", layer: 1 }] },
    ],
    brands: [
      { id: "lamp", name: "Lamp Co", affinity: 0.9, aesthetic: [], because: [{ entityId: "film", score: 0.4 }] },
      { id: "app", name: "Plan App", affinity: 0.8, aesthetic: [], because: [{ entityId: "film", score: 0.3 }] },
    ],
  } as Profile,
};
const found: Entity[] = [
  { entity_id: "hotel", name: "A Hotel", properties: img("hotel") },
  { entity_id: "film", name: "A Film", properties: img("film") },
  { entity_id: "lamp", name: "Lamp Co", properties: img("lamp"), tags: [{ tag_id: "urn:tag:brand_type:qloo:retail_brand" }] },
  { entity_id: "app", name: "Plan App", properties: img("app"), tags: [{ tag_id: "urn:tag:brand_type:qloo:service_brand" }] },
];
const place = (id: string, decor: string[], city?: string): Entity => ({
  entity_id: id,
  name: id,
  properties: { ...img(id), geocode: { city } },
  tags: decor.map((d) => ({ tag_id: `urn:tag:decor:qloo:${d}` })),
});

test("decor for the board comes from things they named, not from matched brands", () => {
  assert.deepEqual(decorTags(p), ["urn:tag:decor:qloo:vintage", "urn:tag:decor:qloo:eclectic"]);
});

test("every photo says why it's there, and apps, photo-less and off-style places are left out", () => {
  const t = tiles(p, found, [place("Casa", ["vintage", "eclectic"], "Barcelona"), place("Airport", ["functional"]), { entity_id: "x", name: "No Photo", tags: [{ tag_id: "urn:tag:decor:qloo:vintage" }] }]);
  assert.deepEqual(t.map((x) => [x.name, x.kind, x.caption]), [
    ["A Hotel", "loved", "You love this place"],
    ["A Film", "loved", "You love this film"],
    ["Casa", "kindred", "Shares your vintage, eclectic look · Barcelona"],
    ["Lamp Co", "matched", "Matched to A Film"],
  ]);
});

test("nothing found means an empty board, not a broken one", () => {
  assert.deepEqual(tiles({ taste_signals: [], taste: null }, [], []), []);
  assert.deepEqual(tiles(p, [], []), []);
});
