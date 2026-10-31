import { test } from "node:test";
import assert from "node:assert/strict";
import { isGallery, kindOf, listenAt, playlistSignals } from "./read.ts";
import type { Entity } from "../qloo/api.ts";

// Synthetic places only.
const place = (name: string, cats: string[]): Entity => ({ entity_id: name, name, tags: cats.map((c) => ({ tag_id: `urn:tag:category:place:${c}` })) });

test("only real galleries and museums count for the art wall", () => {
  assert.ok(isGallery(place("Studio North", ["art_gallery"])));
  assert.ok(isGallery(place("City Museum", ["museum", "tourist_attraction"])));
  assert.ok(!isGallery(place("Corner Coffee", ["art_gallery", "coffee_shop"])));
  assert.ok(!isGallery(place("A park", ["park"])));
  assert.equal(kindOf(place("Studio North", ["art_gallery"])), "gallery");
  assert.equal(kindOf(place("City Museum", ["museum"])), "museum");
});

test("the playlist follows places, films and music, not brands, unless only brands were named", () => {
  const s = [{ entityId: "hotel", type: "urn:entity:place" }, { entityId: "brand", type: "urn:entity:brand" }, { entityId: "film", type: "urn:entity:movie" }];
  assert.deepEqual(playlistSignals(s), ["hotel", "film"]);
  assert.deepEqual(playlistSignals([{ entityId: "brand", type: "urn:entity:brand" }]), ["brand"]);
  assert.equal(listenAt("A. R. Rahman"), "https://music.youtube.com/search?q=A.%20R.%20Rahman");
});
