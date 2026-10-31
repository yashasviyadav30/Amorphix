import { test } from "node:test";
import assert from "node:assert/strict";
import { lightFor, moodsFor, roomMood } from "./mood.ts";
import type { Layout } from "../layout/schema.ts";

const hotel = [{ name: "A hotel", layer: 1 }];
const film = [{ name: "A film", layer: 3 }];
const tag = (value: string, weight: number, sources = hotel, family = "ambience") => ({ family, value, weight, sources });
const tags = [tag("lively", 5), tag("moodily_dark", 4), tag("relaxing", 3), tag("bright", 2), tag("vintage", 9, hotel, "decor"), tag("serene", 8, film)];

test("each room takes the ambience word from what they love that suits it", () => {
  assert.deepEqual(roomMood("bedroom", tags), { word: "relaxing", from: "A hotel", light: lightFor("relaxing") });
  assert.equal(roomMood("kitchen", tags)!.word, "bright");
  assert.equal(roomMood("living", tags)!.word, "lively");
  // A bath wants serene first, but serene only came through a film (layer 3), which never sets a mood.
  assert.equal(roomMood("bath", tags)!.word, "relaxing");
  // Nothing in their words suits a garage: the strongest word they have.
  assert.equal(roomMood("garage", tags)!.word, "lively");
  assert.equal(roomMood("bedroom", [tag("vintage", 9, hotel, "decor")]), null);
});

test("the light follows the mood", () => {
  assert.equal(lightFor("moodily_dark").kelvin, 2700);
  assert.equal(lightFor("bright").kelvin, 4000);
  assert.equal(lightFor("relaxing").kelvin, 3000);
});

test("every room but halls and stores gets a mood", () => {
  const room = (id: string, kind: string, zone: "public" | "private" | "service" | "circulation" = "public") => ({ id, name: id, kind, zone, rect: { x: 0, y: 0, w: 3, h: 3 } });
  const layout = { spaceType: "house", shell: { width: 10, depth: 8 }, floors: [{ level: 0, spaces: [room("bed", "bedroom", "private"), room("hall", "corridor", "circulation"), room("store", "storage", "service")], openings: [] }] } as Layout;
  assert.deepEqual(Object.keys(moodsFor(layout, tags)), ["bed"]);
  assert.deepEqual(moodsFor(layout, undefined), {});
});
