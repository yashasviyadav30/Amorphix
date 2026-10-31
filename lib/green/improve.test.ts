import { test } from "node:test";
import assert from "node:assert/strict";
import { choicesOf, fixes, scoreWith, type Ticked } from "./improve.ts";
import { furnish } from "../three/furniture.ts";
import { templateFor } from "../design/program.ts";
import { planOptionsFor } from "../design/options.ts";
import { buildingShell } from "../layout/footprint.ts";
import { DEFAULT_SHELLS } from "../layout/templates.ts";

const input = (t: "house" | "cafe" | "office" | "apartment") => {
  const p = templateFor(t, t === "house" ? 2 : 1);
  const layout = planOptionsFor(p, buildingShell(p, DEFAULT_SHELLS[t]), { space_type: t })[0];
  return { layout, briefPlants: [{ name: "Fiddle leaf fig" }], lot: { width: 30, depth: 30 }, lush: false };
};

test("ticking every suggestion takes any of our plans to 100, and each tick raises the score", () => {
  for (const t of ["house", "apartment", "cafe", "office"] as const) {
    const i = input(t);
    let ticked: Ticked = [];
    let last = scoreWith(i, {}).exact;
    for (let n = 0; n < 40; n++) {
      const open = fixes(i, ticked);
      if (!open.length) break;
      ticked = [...ticked, open[0]];
      const now = scoreWith(i, choicesOf(ticked)).exact;
      assert.ok(now > last, `${t}: ${open[0].label} raised the score`);
      last = now;
    }
    assert.equal(scoreWith(i, choicesOf(ticked)).score, 100, `${t} reaches 100`);
  }
});

test("unticking undoes exactly that change", () => {
  const i = input("house");
  const open = fixes(i, []);
  const a = open.find((f) => f.change.kind === "plants")!;
  const b = open.find((f) => f.change.kind === "swap")!;
  const both = choicesOf([a, b]);
  const onlyB = choicesOf([b]);
  assert.ok(Object.keys(both.extra ?? {}).length === 1 && !Object.keys(onlyB.extra ?? {}).length);
  assert.deepEqual(onlyB.swap, both.swap);
});

test("added plants really appear in the furniture the 3D draws, on the floor or on a wall shelf", () => {
  const i = input("house");
  const plants = (extra: Record<string, number>) => furnish(i.layout, { extraPlants: extra }).filter((x) => x.role === "plant").length;
  const room = i.layout.floors[1].spaces.find((s) => s.kind === "bedroom")!.id;
  assert.ok(plants({ [room]: 2 }) >= plants({}) + 2);
  assert.ok(furnish(i.layout, { extraPlants: { [room]: 4 } }).some((x) => x.room === room && x.name === "wall plant"), "a full bedroom gets wall shelves");
});

test("add all takes a plan to 100 in one go", async () => {
  const { addAll } = await import("./improve.ts");
  const i = input("apartment");
  assert.equal(scoreWith(i, choicesOf(addAll(i, []))).score, 100);
});
