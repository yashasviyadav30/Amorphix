import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProfile, layerOf } from "./taste.ts";
import type { Entity } from "./api.ts";

// Synthetic entities only: Qloo response data stays out of the repo.
const tag = (id: string) => ({ tag_id: id });
const place: Entity = { entity_id: "p1", name: "A hotel", types: ["urn:entity:place"], tags: [tag("urn:tag:decor:qloo:vintage"), tag("urn:tag:ambience:qloo:moody")] };
const brand: Entity = { entity_id: "b1", name: "A brand", types: ["urn:entity:brand"], tags: [tag("urn:tag:aesthetic_property:qloo:clean_lines"), tag("urn:tag:decor:qloo:vintage")] };
const matched: Entity = {
  entity_id: "m1",
  name: "A matched brand",
  types: ["urn:entity:brand"],
  tags: [tag("urn:tag:aesthetic_property:qloo:natural_materials"), tag("urn:tag:industry:qloo:home_goods")],
  query: { affinity: 0.8, explainability: { "signal.interests.entities": [{ entity_id: "f1", score: 0.6 }] } },
};

test("layers come from entity types", () => {
  assert.equal(layerOf(place), 1);
  assert.equal(layerOf(brand), 2);
  assert.equal(layerOf({ entity_id: "f1", name: "A film", types: ["urn:entity:movie"] }), 3);
});

test("tags are weighted by layer and keep their evidence", () => {
  const p = buildProfile([{ entity: place, layer: 1 }, { entity: brand, layer: 2 }], [matched]);
  const vintage = p.tags.find((t) => t.value === "vintage")!;
  assert.equal(vintage.weight, 3 + 2); // a place counts 3, a brand 2
  assert.deepEqual(vintage.sources.map((s) => s.entityId), ["p1", "b1"]);
  assert.equal(p.tags[0].value, "vintage"); // strongest first
  assert.ok(Math.abs(p.tags.find((t) => t.value === "natural_materials")!.weight - 3) < 1e-9); // all layer-3 matches share one place's weight
  assert.ok(!p.tags.some((t) => t.value === "home_goods")); // industry tags are not style
  assert.deepEqual(p.brands[0].because, [{ entityId: "f1", score: 0.6 }]);
});

test("only brands you could furnish a home from are matched", async () => {
  const { isHomeBrand } = await import("./api.ts");
  const brand = (name: string, type: string) => ({ entity_id: name, name, tags: [{ tag_id: `urn:tag:brand_type:qloo:${type}` }] });
  assert.equal(isHomeBrand(brand("Nourison Home", "retail_brand")), true);
  assert.equal(isHomeBrand(brand("Dwell", "media_brand")), false);
  assert.equal(isHomeBrand(brand("Homestyler", "service_brand")), false, "an app is not furniture");
  assert.equal(isHomeBrand(brand("Chiquelle X Swimwear", "retail_brand")), false);
  const withIndustry = (name: string, industries: string[]) => ({ entity_id: name, name, tags: industries.map((i) => ({ tag_id: `urn:tag:industry:qloo:${i}` })) });
  assert.equal(isHomeBrand(withIndustry("IKEA", ["retail", "home_goods", "furniture"])), true);
  assert.equal(isHomeBrand(withIndustry("Coffee And Things", ["retail", "food_beverage", "interior_design", "publishing"])), false, "a café with a design shelf");
});

test("a neighbourhood steps out to its city, never to a country alone", async () => {
  const { placesToTry } = await import("./api.ts");
  assert.deepEqual(placesToTry("Koregaon Park, Pune, India"), ["Koregaon Park, Pune, India", "Pune, India"]);
  assert.deepEqual(placesToTry("Koregaon Park, Pune"), ["Koregaon Park, Pune", "Pune"]);
  assert.deepEqual(placesToTry("Austin, TX"), ["Austin, TX", "TX"]);
  assert.deepEqual(placesToTry("Pune"), ["Pune"]);
  assert.deepEqual(placesToTry("Bandra West, Mumbai, Maharashtra, India"), ["Bandra West, Mumbai, Maharashtra, India", "Mumbai, Maharashtra, India", "Maharashtra, India"]);
});

test("places that share your look are rooms to learn from, not campsites, parks or resorts", async () => {
  const { isRoomPlace } = await import("./api.ts");
  const at = (name: string, category?: string): Entity => ({ entity_id: name, name, types: ["urn:entity:place"], tags: category ? [tag(`urn:tag:category:place:${category}`)] : [] });
  assert.equal(isRoomPlace(at("Ace Hotel", "hotel")), true);
  assert.equal(isRoomPlace(at("Park Hyatt", "hotel")), true);
  assert.equal(isRoomPlace(at("A café")), true);
  assert.equal(isRoomPlace(at("Tung Lung Chau", "campground")), false);
  assert.equal(isRoomPlace(at("Seaside Beach Resort")), false);
  assert.equal(isRoomPlace(at("Hyde", "park")), false);
});

test("budget hotel chains aren't places to borrow a look from", async () => {
  const { isRoomPlace } = await import("./api.ts");
  const at = (name: string): Entity => ({ entity_id: name, name, types: ["urn:entity:place"], tags: [] });
  assert.equal(isRoomPlace(at("Holiday Inn Rome - Aurelia")), false);
  assert.equal(isRoomPlace(at("Best Western Plus Hotel Colbert")), false);
  assert.equal(isRoomPlace(at("Sunset Marquis")), true);
});

test("a complaint in a place's reviews never becomes a style word", () => {
  const cafe = { entity_id: "c", name: "Blue Bottle Coffee", types: ["urn:entity:place"], tags: [{ tag_id: "urn:tag:ambience:qloo:stuffy" }, { tag_id: "urn:tag:ambience:qloo:lively" }] } as never;
  const values = buildProfile([{ entity: cafe, layer: 2 }], []).tags.map((t) => t.value);
  assert.ok(values.includes("lively"));
  assert.ok(!values.includes("stuffy"));
});
