import { test } from "node:test";
import assert from "node:assert/strict";
import { areaRank, categoriesFor, hintLine, isKind, lookOf, onePerChain, rankLine, runningHint, saidLine } from "./read.ts";
import type { Entity } from "../qloo/api.ts";
import type { StyleTag } from "../qloo/taste.ts";

// Synthetic places only: Qloo data never goes in the repo.
const place = (name: string, tags: string[]): Entity => ({ entity_id: name, name, tags: tags.map((t) => ({ tag_id: t })) });
const cat = (t: string) => `urn:tag:category:place:${t}`;
const decor = (t: string) => `urn:tag:decor:qloo:${t}`;
const amb = (t: string) => `urn:tag:ambience:qloo:${t}`;
const svc = (t: string) => `urn:tag:service_type:qloo:${t}`;

test("each business reads its own kind of place; a shop takes its kind from the shop they love", () => {
  assert.deepEqual(categoriesFor("cafe", []), [cat("cafe")]);
  assert.deepEqual(categoriesFor("office", []), [cat("cafe"), cat("coworking_space")]);
  assert.deepEqual(categoriesFor("shop", [place("A bookshop", [cat("bookstore_shop"), cat("cafe")])]), [cat("bookstore_shop")]);
  assert.equal(categoriesFor("shop", []).length, 4);
  assert.deepEqual(categoriesFor("house", []), []);
});

test("the look of local favourites: common words first, the owner's own marked, and how many share it", () => {
  const style: StyleTag[] = [{ family: "decor", value: "minimalist", weight: 1, sources: [] }];
  const places = [
    place("One", [decor("minimalist"), amb("cozy")]),
    place("Two", [decor("rustic"), amb("cozy")]),
    place("Three", [decor("minimalist")]),
  ];
  const l = lookOf(places, style);
  assert.deepEqual(l.words.slice(0, 2), [
    { word: "cozy", n: 2, yours: false },
    { word: "minimalist", n: 2, yours: true },
  ]);
  assert.deepEqual([l.sharing, l.of], [2, 3]);
});

const cell = (lat: number, lon: number, rank: number) => ({ location: { latitude: lat, longitude: lon }, query: { affinity_rank: rank } });

test("the area's rank in its city, only when there is enough data and a cell near the site", () => {
  const city = Array.from({ length: 100 }, (_, i) => cell(30 + i * 0.1, -97, i / 100)); // rank grows to the north
  assert.equal(areaRank(city, 30 + 95 * 0.1, -97), 5); // fifth from the top
  assert.equal(areaRank(city, 30, -97), 100);
  assert.equal(areaRank(city.slice(0, 7), 30, -97), null); // seven cells: too few to rank
  assert.equal(areaRank(city, 60, -97), null); // nothing near the site
});

test("how the café they love runs becomes a suggestion, not an answer", () => {
  const tokai = place("Blue Tokai", [cat("cafe"), svc("takeout"), "urn:tag:dining_options:place:table_service", "urn:tag:service_options:place:outdoor_seating"]);
  const kiosk = place("Kiosk", [cat("coffee_shop"), "urn:tag:offerings:place:quick_bite"]);
  const hotel = place("A hotel", [cat("hotel"), "urn:tag:dining_options:place:table_service"]);
  assert.deepEqual(runningHint("cafe", [tokai]), { service: "both", outdoor: true, from: ["Blue Tokai"] });
  assert.deepEqual(runningHint("cafe", [kiosk, hotel]), { service: "takeaway", outdoor: undefined, from: ["Kiosk"] });
  assert.equal(runningHint("cafe", [hotel]), null); // no café among what they love
  assert.equal(runningHint("office", [tokai]), null);
  assert.equal(hintLine({ service: "both", outdoor: true, from: ["Blue Tokai"] }), "Like Blue Tokai: sit-down and takeaway, with seats outside.");
});

test("the rank reads honestly, strong or weak", () => {
  assert.equal(rankLine(5, "Austin, TX").text, "Top 5% of Austin for your taste: people around here already love places like yours.");
  assert.equal(rankLine(50, "Pune, India").strength, "average");
  assert.match(rankLine(88, "Austin, TX").text, /rarer here than in most of Austin/);
});

test("the hint sits next to what they said, and agrees only when it does", () => {
  const h = { service: "both" as const, outdoor: true, from: ["Blue Tokai"] };
  assert.deepEqual(saidLine({ service: "both", outdoor: true }, h), { same: true, text: "You said sit-down and takeaway, with seats outside." });
  assert.equal(saidLine({ service: "takeaway", outdoor: true }, h)!.same, false);
  assert.equal(saidLine({ service: null, outdoor: null }, h), null);
});

test("only real cafés count as cafés: not a cinema or a bar that has a café tag", () => {
  assert.ok(isKind("cafe", place("Corner Roasters", [cat("cafe"), cat("coffee_shop")])));
  assert.ok(isKind("cafe", place("Café Lumen", [cat("cafe"), cat("restaurant")]))); // says café in its name
  assert.ok(!isKind("cafe", place("Picture House", [cat("cafe"), cat("movie_theater"), cat("coffee_shop")])));
  assert.ok(!isKind("cafe", place("Salt Bar", [cat("cafe"), cat("bar")])));
  assert.ok(!isKind("cafe", place("Sky Deck", [cat("cafe"), cat("observation_deck")])));
  assert.ok(isKind("office", place("Desk Club", [cat("coworking_space")])));
  assert.ok(isKind("hotel", place("The Inn", [cat("hotel")])));
});

test("one place per chain, so a list isn't five branches of the same coffee shop", () => {
  const names = ["Bean Co", "Bean Co Coffee Company", "Bean Co - Riverside", "The Corner Cafe", "The Mill", "Cafe Lumen", "Cafe Rosa", "OK 9224 Rooms", "OK Galaxy"];
  assert.deepEqual(onePerChain(names.map((name) => ({ name }))).map((p) => p.name), ["Bean Co", "The Corner Cafe", "The Mill", "Cafe Lumen", "Cafe Rosa", "OK 9224 Rooms"]);
});
