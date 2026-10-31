import { test } from "node:test";
import assert from "node:assert/strict";
import type { Entity } from "../qloo/api.ts";
import { closeness, matchesFor, resolvePicks, vagueHint } from "./taste.ts";

// Synthetic look-ups shaped like Qloo's search results.
const e = (name: string, type: string, extra: Partial<Entity> = {}): Entity => ({ entity_id: name.toLowerCase().replace(/\W+/g, "-"), name, types: [`urn:entity:${type}`], ...extra });

test("a genre is not a film: a vague answer finds nothing", () => {
  const found = [e("The Science Fiction Bookstore", "place"), e("Star Begotten (Early Classics of Science Fiction)", "book")];
  assert.deepEqual(matchesFor("media", "marvels techy science fiction", found), []);
  assert.deepEqual(matchesFor("place", "marvels techy science fiction", found), [], "half the words is not a match");
  assert.match(vagueHint("media"), /film, show, artist or album/);
});

test("each question keeps only its own kind of thing", () => {
  const found = [e("Apple", "videogame"), e("Apple Inc", "brand"), e("Apple", "album")];
  assert.deepEqual(matchesFor("brand", "Apple", found).map((c) => c.name), ["Apple Inc"]);
  assert.deepEqual(matchesFor("media", "Apple", found).map((c) => c.kind), ["album"]);
  assert.deepEqual(matchesFor("place", "Apple", found), []);
});

test("a city in the answer can match the address, and accents and endings don't matter", () => {
  const blue = e("Blue Tokai Coffee Roasters", "place", { properties: { address: "Saket, New Delhi" } });
  assert.equal(closeness("Blue Tokai Delhi", blue), 1);
  assert.equal(closeness("ace hotel", e("Ace Hôtel", "place")), 1);
  assert.equal(closeness("marvels avengers", e("Marvel's The Avengers", "movie")), 1);
  assert.equal(closeness("   ", blue), 0);
});

test("closest names first, at most three", () => {
  const found = [e("Interstellar Cafe", "place"), e("Interstellar", "movie"), e("Interstellar", "album"), e("Interstellar Live", "artist"), e("Interstellar 2", "movie")];
  const m = matchesFor("media", "interstellar", found);
  assert.equal(m.length, 3);
  assert.deepEqual(m.map((c) => c.kind), ["film", "album", "music"]);
});

test("picks are checked again on the server: all three, right kind, same entity", async () => {
  const db = [e("Ace Hotel", "place"), e("Muji", "brand"), e("Interstellar", "movie")];
  const find = async (q: string) => db.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()));
  const picks = [
    { slot: "place" as const, id: "ace-hotel", name: "Ace Hotel" },
    { slot: "brand" as const, id: "muji", name: "Muji" },
    { slot: "media" as const, id: "interstellar", name: "Interstellar" },
  ];
  assert.deepEqual((await resolvePicks(picks, find)).map((x) => x.name), ["Ace Hotel", "Muji", "Interstellar"]);
  await assert.rejects(resolvePicks(picks.slice(0, 2), find), /film, show or music/);
  await assert.rejects(resolvePicks([picks[0], { ...picks[1], id: "ace-hotel", name: "Ace Hotel" }, picks[2]], find), /Pick it again/, "a place sent as the brand");
  await assert.rejects(resolvePicks([picks[0], picks[1], { ...picks[2], id: "made-up" }], find), /Pick it again/);
});

test("a place in the project's city comes before one of the same name elsewhere", () => {
  const found = [e("Hotel Bel-Air", "place", { entity_id: "far", properties: { address: "Paris, France" } }), e("Hotel Bel-Air", "place", { entity_id: "near", properties: { address: "701 Stone Canyon Rd, Los Angeles, CA" } })];
  assert.equal(matchesFor("place", "Hotel Bel-Air", found, "Los Angeles, CA")[0].entityId, "near");
  assert.equal(matchesFor("place", "Hotel Bel-Air", found)[0].entityId, "far");
});
