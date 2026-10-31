import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfileInput, safeNext } from "./profile.ts";

test("a homeowner needs only a name; builder-only fields are dropped", () => {
  const p = ProfileInput.parse({ role: "owner", name: " Priya ", city: "", crew_size: 12, trades: ["tiling"] });
  assert.equal(p.name, "Priya");
  assert.equal(p.city, null);
  assert.equal(p.crew_size, null);
  assert.deepEqual(p.trades, []);
  assert.equal(p.units, "metric");
});

test("architects and builders must name their studio or company", () => {
  assert.equal(ProfileInput.safeParse({ role: "architect", name: "Ana" }).success, false);
  assert.equal(ProfileInput.safeParse({ role: "builder", name: "Raj", company: "  " }).success, false);
  const b = ProfileInput.parse({ role: "builder", name: "Raj", company: "Raj Builders", crew_size: "14", trades: ["masonry"] });
  assert.equal(b.crew_size, 14);
  assert.deepEqual(b.trades, ["masonry"]);
});

test("bad input is refused", () => {
  for (const bad of [{ role: "admin", name: "x" }, { role: "owner", name: "" }, { role: "owner", name: "x".repeat(81) }, { role: "builder", name: "x", company: "y", crew_size: 0 }])
    assert.equal(ProfileInput.safeParse(bad).success, false, JSON.stringify(bad));
});

test("only same-site paths are followed after sign-in", () => {
  assert.equal(safeNext("/project/abc"), "/project/abc");
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "", null, undefined]) assert.equal(safeNext(bad), "/home");
});
