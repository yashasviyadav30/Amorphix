import { test } from "node:test";
import assert from "node:assert/strict";
import { GOLDEN_ANGLE_DEG, SIZE, seeds, seedsSvg } from "./seeds.ts";

test("the mark has 70 seeds, every eighth in the accent colour", () => {
  const s = seeds();
  assert.equal(s.length, 70);
  assert.equal(s.filter((d) => d.accent).length, 8);
  assert.ok(s[7].accent && !s[6].accent);
});

test("every seed sits inside the viewBox", () => {
  for (const d of seeds()) {
    assert.ok(d.x - d.r >= 0 && d.x + d.r <= SIZE, `x ${d.x}`);
    assert.ok(d.y - d.r >= 0 && d.y + d.r <= SIZE, `y ${d.y}`);
  }
});

test("consecutive seeds turn by the golden angle", () => {
  const [a, b] = seeds(2);
  const angle = (p: { x: number; y: number }) => (Math.atan2(p.y - SIZE / 2, p.x - SIZE / 2) * 180) / Math.PI;
  const turn = (((angle(b) - angle(a)) % 360) + 360) % 360;
  assert.ok(Math.abs(turn - GOLDEN_ANGLE_DEG) < 0.5, `turn ${turn}`);
});

test("seeds grow toward the rim", () => {
  const s = seeds();
  assert.ok(s[0].r < s[69].r);
});

test("the standalone svg carries every seed and the background", () => {
  const svg = seedsSvg({ ink: "#000", accent: "#f00", background: "#fff" });
  assert.equal((svg.match(/<circle /g) ?? []).length, 70);
  assert.equal((svg.match(/fill="#f00"/g) ?? []).length, 8);
  assert.match(svg, /<rect [^>]*fill="#fff"/);
});
