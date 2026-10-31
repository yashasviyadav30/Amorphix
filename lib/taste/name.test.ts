import { test } from "node:test";
import assert from "node:assert/strict";
import { styleName } from "./name.ts";
import type { Profile, StyleTag } from "./types.ts";

const tag = (family: StyleTag["family"], value: string, weight: number): StyleTag => ({ family, value, weight, sources: [] });
const p = (...tags: StyleTag[]): Profile => ({ tags, brands: [] });

test("one clear look gives its name", () => {
  assert.equal(styleName(p(tag("decor", "japandi", 9), tag("decor", "industrial", 3))), "Japandi");
});

test("two looks of near equal strength meet", () => {
  assert.equal(styleName(p(tag("decor", "industrial", 9), tag("decor", "minimalist", 8))), "Industrial Meets Minimalist".replace(" Meets ", " meets "));
});

test("mid-century keeps its hyphen", () => {
  assert.equal(styleName(p(tag("decor", "mid_century_modern", 5))), "Mid-Century Modern");
});

test("no decor word falls back to the strongest word, then to a default", () => {
  assert.equal(styleName(p(tag("ambience", "cozy", 4))), "Cozy");
  assert.equal(styleName(p()), "Your own style");
});
