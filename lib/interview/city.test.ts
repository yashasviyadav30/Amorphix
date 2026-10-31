import { test } from "node:test";
import assert from "node:assert/strict";
import { cityLabel } from "./city.ts";
import { usesFeet } from "./script.ts";

test("a city reads the way people write it, with its country, and US cities keep feet", () => {
  const la = cityLabel({ address: { city: "Los Angeles", state: "California", country: "United States" } });
  assert.equal(la, "Los Angeles, CA");
  assert.equal(usesFeet(la!), true);
  assert.equal(cityLabel({ address: { village: "Delih", country: "Slovenia" } }), "Delih, Slovenia");
  assert.equal(cityLabel({ address: { city: "Delhi", country: "India" } }), "Delhi, India");
  assert.equal(cityLabel({ name: "Brooklyn", address: { suburb: "Brooklyn", country: "United States" } }), "Brooklyn, USA");
  assert.equal(cityLabel({ address: { city: "Nowhere" } }), null);
});

test("a borough keeps its own name, not the city around it", () => {
  assert.equal(cityLabel({ name: "Brooklyn", address: { suburb: "Brooklyn", city: "New York", state: "New York", country: "United States" } }), "Brooklyn, NY");
});
