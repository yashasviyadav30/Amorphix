import { test } from "node:test";
import assert from "node:assert/strict";
import { creditOf, nameWords, sayCredit, styleWords, tasteTrail } from "./trail.ts";
import type { Profile } from "../qloo/taste.ts";
import type { Brief } from "./brief.ts";
import type { Layout } from "../layout/schema.ts";

// Synthetic taste: a hotel and a film they love, and one brand Qloo matched to them.
const p = {
  taste_signals: [
    { entityId: "hotel", name: "A Hotel", layer: 1 as const },
    { entityId: "film", name: "A Film", layer: 3 as const, type: "urn:entity:movie" },
  ],
  taste: {
    tags: [
      { family: "decor", value: "post_industrial", weight: 3, sources: [{ entityId: "hotel", name: "A Hotel", layer: 1 }] },
      { family: "aesthetic", value: "clean_lines", weight: 2.5, sources: [{ entityId: "lamp", name: "Lamp Co", layer: 3 }] },
      { family: "tone", value: "warm", weight: 2, sources: [{ entityId: "hotel", name: "A Hotel", layer: 1 }] },
      { family: "ambience", value: "moodily_dark", weight: 1.5, sources: [{ entityId: "hotel", name: "A Hotel", layer: 1 }] },
    ],
    brands: [{ id: "lamp", name: "Lamp Co", affinity: 0.9, aesthetic: ["clean_lines", "brass_details"], because: [{ entityId: "film", score: 0.4 }, { entityId: "hotel", score: 0.1 }] }],
  } as Profile,
};

test("a matched brand is credited with what it was matched to, never as loved", () => {
  assert.deepEqual(creditOf(p, "A Hotel"), { name: "A Hotel", loved: true, via: [] });
  const lamp = creditOf(p, "Lamp Co");
  assert.equal(lamp.loved, false);
  assert.deepEqual(lamp.via, ["A Film", "A Hotel"], "strongest match first");
  assert.equal(sayCredit(lamp), "Lamp Co, matched to A Film and A Hotel");
});

test("style words: loved sources first, tone left out, each with its source", () => {
  const w = styleWords(p);
  assert.deepEqual(w.map((x) => x.word), ["post industrial", "moodily dark", "clean lines"]);
  assert.equal(w[0].from[0].name, "A Hotel");
  assert.equal(w[2].from[0].loved, false);
});

test("a style name is traced to the words it is built from", () => {
  const w = styleWords(p);
  assert.deepEqual(nameWords("Industrial Moody Loft", w).map((x) => x.word), ["post industrial", "moodily dark"]);
  assert.deepEqual(nameWords("Coastal Calm", w), []);
});

test("the trail ties every choice to evidence and drops choices with none", () => {
  const brief: Brief = {
    name: "Industrial Moody",
    summary: "",
    palette: [
      { name: "Soot", hex: "#222222", role: "base", from: ["A Hotel"] },
      { name: "Brass", hex: "#b08d57", role: "metal", from: ["Lamp Co"] },
      { name: "Chalk", hex: "#eeeeee", role: "accent", from: [] },
    ],
    materials: [{ name: "Black steel", where: "windows", from: ["A Hotel"] }],
    lighting: { mood: "Low and moody", fixtures: ["pendants"], from: ["A Hotel"] },
    plants: [],
  };
  const chosen = { concept: { id: "split", name: "Split", why: ["Things you love, like A Hotel, lean calm, so the bedrooms are tucked away.", "You said \"quiet\"."] } } as Layout;
  const t = tasteTrail(p, brief, chosen);
  assert.deepEqual(t.loves.map((l) => [l.name, l.kind]), [["A Hotel", "place"], ["A Film", "film"]]);
  assert.deepEqual(t.loves[0].gave, ["post industrial", "moodily dark"]);
  assert.deepEqual(t.loves[1].led, [{ name: "Lamp Co", strength: 0.4 }]);
  assert.deepEqual(t.matched[0].to.map((x) => x.name), ["A Film", "A Hotel"]);
  const whats = t.choices.map((c) => `${c.what}: ${c.choice}`);
  assert.ok(whats.includes("Style: Industrial Moody"));
  assert.ok(whats.includes("Colour (metal): Brass"));
  assert.ok(!whats.some((w) => w.includes("Chalk")), "a colour with no source isn't claimed");
  assert.equal(t.choices.filter((c) => c.what === "Plan").length, 1, "only the taste-backed plan reason");
  assert.equal(tasteTrail({ taste_signals: [], taste: null }, null).choices.length, 0);
});

test("style words take turns between the things they love", () => {
  const tag = (value: string, weight: number, entityId: string) => ({ family: "decor" as const, value, weight, sources: [{ entityId, name: entityId, layer: 1 as const }] });
  const q = { taste_signals: [], taste: { tags: [tag("a1", 9, "A"), tag("a2", 8, "A"), tag("a3", 7, "A"), tag("b1", 2, "B")], brands: [] } };
  assert.deepEqual(styleWords(q, 3).map((w) => w.word), ["a1", "b1", "a2"]);
});
