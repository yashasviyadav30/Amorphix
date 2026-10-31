import { test } from "node:test";
import assert from "node:assert/strict";
import { keyOf, linkOf, parsePicks, ROUNDS, sameName } from "./picks.ts";

test("every option has a unique key, eight per round", () => {
  for (const r of ROUNDS) {
    assert.equal(r.names.length, 8, r.slot);
    assert.equal(new Set(r.names.map(keyOf)).size, 8, r.slot);
  }
  assert.equal(keyOf("Amélie"), "amelie");
  assert.equal(keyOf("A. R. Rahman"), "a-r-rahman");
});

test("a shared link carries the three picks and nothing else gets in", () => {
  const picks = { place: "Aman Tokyo", brand: "Muji", media: "Amélie" };
  assert.equal(linkOf(picks), "aman-tokyo.muji.amelie");
  assert.deepEqual(parsePicks("aman-tokyo.muji.amelie"), picks);
  assert.equal(parsePicks("aman-tokyo.muji"), null); // a round missing
  assert.equal(parsePicks("aman-tokyo.supreme.amelie"), null); // not on the list
  assert.equal(parsePicks("muji.aman-tokyo.amelie"), null); // wrong round
  assert.equal(parsePicks(null), null);
});

test("a search result only counts when it is the thing asked for", () => {
  assert.ok(sameName("The Taj Mahal Palace Mumbai", "The Taj Mahal Palace, Mumbai"));
  assert.ok(sameName("A. R. Rahman", "A.R. Rahman"));
  assert.ok(!sameName("Hoxton Hotel", "HOTEL HOXTON PRIDE"));
  assert.ok(!sameName("Good Earth", "Google Earth"));
});
