import { test } from "node:test";
import assert from "node:assert/strict";
import { lightFit, plantOf } from "./plants.ts";
import { greenery, lightOf } from "./score.ts";
import { timeline } from "../budget/timeline.ts";
import { furnish } from "../three/furniture.ts";
import { templateFor } from "../design/program.ts";
import { planOptionsFor } from "../design/options.ts";
import { buildingShell } from "../layout/footprint.ts";
import { DEFAULT_SHELLS } from "../layout/templates.ts";

const plan = (t: "house" | "apartment" | "cafe") => {
  const p = templateFor(t, t === "house" ? 2 : 1);
  return planOptionsFor(p, buildingShell(p, DEFAULT_SHELLS[t]), { space_type: t })[0];
};

test("plant names people use are recognised, including aliases and botanical names", () => {
  assert.equal(plantOf("Monstera Deliciosa")?.name, "Monstera");
  assert.equal(plantOf("money plant")?.name, "Pothos");
  assert.equal(plantOf("Sansevieria")?.name, "Snake plant");
  assert.equal(plantOf("Potted herbs on the sill")?.name, "Herbs");
  assert.equal(plantOf("Triffid"), null);
});

test("light fit: enough light is perfect, one step short is half, two steps short fails", () => {
  const fig = plantOf("fiddle leaf fig")!;
  assert.equal(lightFit(fig, "bright"), 1);
  assert.equal(lightFit(fig, "medium"), 0.5);
  assert.equal(lightFit(fig, "low"), 0);
  assert.equal(lightFit(plantOf("snake plant")!, "low"), 1);
});

test("a room's light comes from its windows; a windowless room is low light", () => {
  const house = plan("house");
  const lit = house.floors[0].spaces.find((s) => s.kind === "living")!;
  assert.notEqual(lightOf(house, lit.id), "low");
  assert.equal(lightOf(house, "no-such-room"), "low");
});

test("the score rewards plants that suit the rooms, and every weak room gets a tip", () => {
  const house = plan("house");
  const items = furnish(house);
  const hardy = greenery(house, items, [{ name: "Snake plant" }, { name: "Pothos" }, { name: "ZZ plant" }, { name: "Rubber plant" }]);
  const fussy = greenery(house, items, [{ name: "Fiddle leaf fig" }]);
  assert.ok(hardy.score > fussy.score, `${hardy.score} > ${fussy.score}`);
  assert.ok(hardy.score >= 0 && hardy.score <= 100);
  assert.equal(hardy.species.length, 4);
  for (const r of fussy.rooms) if (r.score < 90) assert.ok(r.tip, `${r.name} has a tip`);
  // More plants (the lush 3D) score higher than the usual one per room.
  assert.ok(greenery(house, furnish(house, { lush: true }), [{ name: "Pothos" }]).score >= greenery(house, items, [{ name: "Pothos" }]).score);
  assert.deepEqual(greenery(house, items, [{ name: "Triffid" }]).unknown, ["Triffid"]);
});

test("a garden on the lot lifts the score; no garden leaves it alone", () => {
  const house = plan("house");
  const items = furnish(house);
  const tight = greenery(house, items, [{ name: "Pothos" }], house.shell);
  const big = greenery(house, items, [{ name: "Pothos" }], { width: house.shell.width * 2, depth: house.shell.depth * 2 });
  assert.equal(tight.garden, null);
  assert.ok(big.garden && big.garden.share > 0.7);
  assert.ok(big.score > tight.score);
});

test("timeline: phases in order, a new build takes far longer, premium pieces take longer to arrive", () => {
  const house = plan("house");
  const fit = timeline(house, "mid");
  assert.deepEqual(fit.phases.map((p) => p.id), ["design", "prep", "services", "joinery", "finishes", "furniture", "plants", "handover"]);
  for (const p of fit.phases) assert.ok(p.start + p.weeks <= fit.weeks && p.weeks >= 1);
  const build = timeline(house, "mid", true);
  assert.ok(build.phases.some((p) => p.id === "permits") && build.weeks > fit.weeks + 15);
  assert.ok(timeline(house, "luxury").weeks > timeline(house, "essential").weeks);
  assert.equal(timeline(plan("cafe"), "mid").phases.find((p) => p.id === "joinery")!.name, "Counter, kitchen and fixtures");
  // A typical apartment fit-out lands at a few months, not weeks or years.
  const apt = timeline(plan("apartment"), "mid").weeks;
  assert.ok(apt >= 8 && apt <= 26, `${apt} weeks`);
});

test("eco brands: only home brands with real initiatives, loved first, matched ones say what they matched", async () => {
  const { ecoBrands } = await import("./eco.ts");
  const p = {
    taste_signals: [{ entityId: "ikea", name: "IKEA", layer: 2 as const }, { entityId: "film", name: "A Film", layer: 3 as const }],
    taste: { tags: [], brands: [{ id: "lamp", name: "Lamp Co", affinity: 0.9, aesthetic: [], because: [{ entityId: "film", score: 0.4 }] }] },
  };
  const brand = (id: string, name: string, eco: string[], type = "retail_brand") => ({
    entity_id: id,
    name,
    types: ["urn:entity:brand"],
    tags: [{ tag_id: `urn:tag:brand_type:qloo:${type}` }, ...eco.map((n) => ({ tag_id: `urn:tag:sustainability_initiative:qloo:${n}`, name: n }))],
  });
  const out = ecoBrands(p, [brand("lamp", "Lamp Co", ["Recycled Materials"]), brand("ikea", "IKEA", ["Circular Economy Design"]), brand("plain", "Plain", []), brand("app", "App", ["Green Hosting"], "service_brand")]);
  assert.deepEqual(out.map((b) => [b.name, b.loved, b.via, b.does]), [
    ["IKEA", true, [], ["Circular Economy Design"]],
    ["Lamp Co", false, ["A Film"], ["Recycled Materials"]],
  ]);
});
