import { test } from "node:test";
import assert from "node:assert/strict";
import { look, luminance, mix, scheme, styleOf } from "./materials.ts";

const palette = [
  { hex: "#4a4a4a", role: "base" },
  { hex: "#b8860b", role: "metal" },
  { hex: "#8b4513", role: "wood" },
  { hex: "#2f5d45", role: "green" },
  { hex: "#e8e0d4", role: "textile" },
];

test("mixing and brightness behave", () => {
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  assert.ok(luminance("#ffffff") > 0.99 && luminance("#000000") < 0.01);
});

test("the model takes its colours from the brief", () => {
  const s = scheme(palette);
  assert.equal(s.floor, "#8b4513");
  assert.equal(s.wood, "#8b4513");
  assert.equal(s.metal, "#b8860b");
  assert.equal(s.textile, "#e8e0d4");
  assert.equal(s.plant, "#2f5d45");
});

test("walls stay bright even with a dark palette", () => {
  const dark = scheme([{ hex: "#222222", role: "base" }, { hex: "#333333", role: "wood" }]);
  assert.ok(luminance(dark.wall) > 0.5, dark.wall);
});

test("no palette falls back to a neutral scheme", () => {
  assert.equal(scheme(undefined).wall, "#f2efe9");
});

test("the brief's words choose the wall finish and tile", () => {
  const brief = { name: "Moody Eclectic", summary: "", palette, materials: [{ name: "Walnut slat panelling", where: "living feature wall" }, { name: "Green zellige", where: "kitchen backsplash" }] };
  const l = look(brief);
  assert.equal(l.finish, "panel");
  assert.equal(l.feature, "#8b4513");
  assert.equal(l.tileKind, "zellige");
  assert.equal(look({ ...brief, materials: [{ name: "Limewash", where: "walls" }] }).finish, "plaster");
  assert.equal(look(null).finish, "paint");
});

test("Qloo taste tags choose the furniture style and say which loves chose it", () => {
  const taste = {
    tags: [
      { value: "mid_century_modern", weight: 3, sources: [{ name: "Hotel A" }] },
      { value: "retro", weight: 1.5, sources: [{ name: "Cafe B" }] },
      { value: "industrial", weight: 1, sources: [{ name: "Bar C" }] },
      { value: "cozy", weight: 1, sources: [{ name: "Cafe B" }] },
    ],
    brands: [{ name: "Brand D", aesthetic: ["retro"] }],
  };
  const s = styleOf(taste, "");
  assert.equal(s.style, "midcentury");
  assert.deepEqual(s.because, ["Hotel A", "Cafe B"]);
  assert.deepEqual(s.matched, ["Brand D"]);
  assert.equal(s.cozy, true);
  assert.equal(s.lush, false);
  assert.equal(styleOf(null, "").style, "modern");
  assert.equal(styleOf(null, "lush botanical rattan").lush, true);
  assert.equal(look(null, taste).style, "midcentury");
});

test("the brief's style name leads, so the 3D matches the style page", () => {
  const calm = { tags: [{ value: "minimalist", weight: 4, sources: [{ name: "Hotel A" }] }, { value: "calm", weight: 3, sources: [{ name: "Spa B" }] }], brands: [] };
  assert.equal(styleOf(calm, "").style, "scandi");
  assert.equal(styleOf(calm, "", "Industrial Bohemian").style, "industrial");
  assert.equal(look({ name: "Warm Bohemian", palette }, calm).style, "boho");
});

test("brands Qloo matched are never credited as things the user loves", () => {
  const taste = {
    tags: [{ value: "industrial", weight: 5, sources: [{ name: "Matched Brand", layer: 3 }, { name: "Named Hotel", layer: 1 }] }],
    brands: [{ name: "Other Match", aesthetic: ["industrial"] }],
  };
  const s = styleOf(taste, "");
  assert.deepEqual(s.because, ["Named Hotel"]);
  assert.ok(s.matched.includes("Matched Brand") && !s.because.includes("Matched Brand"));
});
