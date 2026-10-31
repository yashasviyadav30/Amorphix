import { test } from "node:test";
import assert from "node:assert/strict";
import { cosine, fitOf, rank, vectorOf, word } from "./match.ts";

const t = (...tags: [string, string, number][]) => ({ tags: tags.map(([family, value, weight]) => ({ family, value, weight })) });
const warm = t(["decor", "industrial", 3], ["decor", "mid_century_modern", 2], ["ambience", "cozy", 1]);
const sameish = t(["decor", "industrial", 2], ["decor", "mid_century_modern", 2]);
const other = t(["decor", "minimalist", 3], ["ambience", "bright", 2]);

test("vectors add up a pro's projects; cosine is 1 for the same direction and 0 for nothing shared", () => {
  const v = vectorOf([sameish, sameish]);
  assert.equal(v.get("decor:industrial"), 4);
  assert.equal(Math.round(cosine(vectorOf([warm]), vectorOf([warm])) * 1000), 1000);
  assert.equal(cosine(vectorOf([warm]), vectorOf([other])), 0);
});

test("a pro whose work shares the client's style fits far better, and says which words they share", () => {
  const good = fitOf(warm, "Pune, India", { tastes: [sameish], city: "Mumbai" });
  const bad = fitOf(warm, "Pune, India", { tastes: [other], city: "Mumbai" });
  assert.ok(good.score > 80 && bad.score < 10, `${good.score} vs ${bad.score}`);
  assert.deepEqual(good.shared, ["industrial", "mid century modern"]);
  assert.deepEqual(bad.shared, []);
});

test("the same city helps a little; a pro with no projects yet is neutral and says so", () => {
  const near = fitOf(warm, "Pune, India", { tastes: [other], city: "pune" });
  assert.equal(near.sameCity, true);
  assert.equal(near.score, 10);
  const fresh = fitOf(warm, "Pune", { tastes: [], city: "Delhi" });
  assert.equal(fresh.hasWork, false);
  assert.equal(fresh.score, 45);
});

test("ranking: best fit first, then same city, then pros with work", () => {
  const f = (score: number, sameCity = false, hasWork = true) => ({ fit: { score, shared: [], sameCity, hasWork } });
  const order = rank([f(40), f(90), f(40, true), f(40, false, false)]).map((p) => [p.fit.score, p.fit.sameCity, p.fit.hasWork]);
  assert.deepEqual(order, [[90, false, true], [40, true, true], [40, false, true], [40, false, false]]);
});

test("tag values read as words", () => {
  assert.equal(word("mid_century_modern"), "mid century modern");
});
