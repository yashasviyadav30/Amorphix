import { test } from "node:test";
import assert from "node:assert/strict";
import { toDxf } from "./dxf.ts";
import { placeConcept } from "../layout/concepts.ts";
import { TEMPLATES, DEFAULT_SHELLS } from "../layout/templates.ts";
import { buildingShell } from "../layout/footprint.ts";

const program = TEMPLATES.house;
const house = placeConcept(program, buildingShell(program, DEFAULT_SHELLS.house), "hall-street")!;

test("a DXF with every room, door and window, and both floors", () => {
  const dxf = toDxf(house, "The Pune house");
  const rows = dxf.split("\n");
  // pairs of code and value, ending in EOF
  assert.equal(rows.length % 2, 1);
  assert.equal(rows.at(-2), "EOF");
  assert.ok(dxf.startsWith("0\nSECTION\n2\nHEADER\n"));
  const rooms = house.floors.flatMap((f) => f.spaces.filter((s) => s.zone !== "circulation"));
  for (const r of rooms) assert.ok(dxf.includes(`1\n${r.name}\n`), r.name);
  const openings = house.floors.flatMap((f) => f.openings).length;
  assert.equal((dxf.match(/\n8\nDOORS\n|\n8\nWINDOWS\n/g) ?? []).length, openings);
  assert.ok(dxf.includes("The Pune house - Ground floor") && dxf.includes("The Pune house - Upstairs"));
  assert.ok(dxf.includes("Made with Amorphix"));
});

test("names can't break the file", () => {
  const first = house.floors[0].spaces.find((s) => s.zone !== "circulation")!.id;
  const odd = { ...house, floors: [{ ...house.floors[0], spaces: house.floors[0].spaces.map((s) => (s.id === first ? { ...s, name: "Kids\nroom" } : s)) }] };
  assert.ok(toDxf(odd, "x").includes("1\nKids room\n"));
});

test("the DXF carries the drawings pack: tags, overall dimensions and four elevations", () => {
  const dxf = toDxf(house, "The Pune house");
  for (const side of ["Street side", "Back", "Left side", "Right side"]) assert.ok(dxf.includes(`The Pune house - ${side} elevation`), side);
  assert.ok(dxf.includes("1\nD01\n") && dxf.includes("1\nW01\n"));
  assert.ok(dxf.includes(`1\n${house.shell.width.toFixed(2)} m\n`));
  assert.ok((dxf.match(/\n8\nELEVATIONS\n/g) ?? []).length > 20);
});
