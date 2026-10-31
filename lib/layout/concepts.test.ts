import { test } from "node:test";
import assert from "node:assert/strict";
import { CONCEPT_IDS, placeConcept, type ConceptId } from "./concepts.ts";
import { buildingShell } from "./footprint.ts";
import { place } from "./place.ts";
import { DEFAULT_SHELLS, TEMPLATES } from "./templates.ts";
import { validate } from "./validate.ts";
import { isOpen, wallPieces } from "./walls.ts";
import type { Layout, Program, ProgramRoom } from "./schema.ts";
import { furnish, missingEssentials } from "../three/furniture.ts";
import { decorate } from "../three/decor.ts";
import { walkPlan } from "../three/geometry.ts";
import { blockers, wallCrossings } from "../three/explore.ts";

const shellOf = (p: Program) => buildingShell(p, DEFAULT_SHELLS[p.spaceType]);
const house = TEMPLATES.house;
// A roomier version of the house template's footprint, wide enough for every concept including the split plan
// (the template's own 10.8 m is too tight for two wings plus a stairwell, and the engine rightly says so).
const roomy = { width: 13, depth: 8.4 };
const at = (c: ConceptId, p: Program = house) => placeConcept(p, p === house ? roomy : shellOf(p), c)!;

function placedOnce(l: Layout, p: Program) {
  const ids = l.floors.flatMap((f) => f.spaces.filter((s) => s.zone !== "circulation").map((s) => s.id));
  assert.deepEqual([...ids].sort(), p.rooms.map((r) => r.id).sort());
}

for (const [type, program] of Object.entries(TEMPLATES))
  test(`${type}: at least three concepts fit, and each passes the validator and places every room once`, () => {
    let fits = 0;
    for (const c of CONCEPT_IDS) {
      const l = placeConcept(program, shellOf(program), c);
      if (!l) continue;
      fits++;
      assert.deepEqual(validate(l), []);
      placedOnce(l, program);
    }
    // A hotel template is one typical guest floor: a corridor with rooms both sides is the only sensible idea,
    // so only the two corridor concepts apply. Every other type gets at least three.
    assert.ok(fits >= (type === "hotel" ? 2 : 3), `${type}: only ${fits} concepts fit`);
  });

test("the four concepts are four different houses, not flips of one", () => {
  const sig = (l: Layout) => JSON.stringify(l.floors[0].spaces.map((s) => [s.id, s.rect.x.toFixed(1), s.rect.y.toFixed(1), s.rect.w.toFixed(1)]).sort());
  const sigs = CONCEPT_IDS.map((c) => sig(at(c)));
  assert.equal(new Set(sigs).size, 4);
});

test("great room: one open living space with the front door on the street side", () => {
  const l = at("great-room");
  const g = l.floors[0];
  const entry = g.openings.find((o) => o.id === "door-entry")!;
  assert.equal(entry.y, 0, "front door on the street facade");
  const pub = g.spaces.filter((s) => s.zone === "public");
  assert.ok(pub.every(isOpen));
  // No solid wall stands between any two public rooms.
  const solid = wallPieces(g, l.shell).filter((p) => !p.open);
  const touches = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
    (Math.abs(a.x + a.w - b.x) < 1e-6 || Math.abs(b.x + b.w - a.x) < 1e-6 || Math.abs(a.y + a.h - b.y) < 1e-6 || Math.abs(b.y + b.h - a.y) < 1e-6);
  for (const a of pub)
    for (const b of pub)
      if (a !== b && touches(a.rect, b.rect)) {
        const vertical = Math.abs(a.rect.x + a.rect.w - b.rect.x) < 1e-6;
        const line = vertical ? a.rect.x + a.rect.w : null;
        if (line !== null) {
          const lo = Math.max(a.rect.y, b.rect.y);
          const hi = Math.min(a.rect.y + a.rect.h, b.rect.y + b.rect.h);
          assert.ok(!solid.some((p) => p.axis === "z" && Math.abs(p.at - line) < 1e-6 && p.from < hi - 1e-6 && p.to > lo + 1e-6), `${a.id}|${b.id} walled`);
        }
      }
});

test("split plan: rooms at both ends of the living band, and the en-suite opens into its bedroom", () => {
  const l = at("split");
  for (const f of l.floors) {
    const pub = f.spaces.filter((s) => s.zone === "public");
    const x0 = Math.min(...pub.map((s) => s.rect.x));
    const x1 = Math.max(...pub.map((s) => s.rect.x + s.rect.w));
    const others = f.spaces.filter((s) => s.zone !== "public");
    assert.ok(others.some((s) => s.rect.x + s.rect.w <= x0 + 1e-6), `floor ${f.level}: rooms left of the band`);
    assert.ok(others.some((s) => s.rect.x >= x1 - 1e-6), `floor ${f.level}: rooms right of the band`);
  }
  const up = l.floors[1];
  const door = up.openings.find((o) => o.type === "door" && o.between.includes("primary-bath"))!;
  assert.ok(door.between.includes("primary"), `en-suite opens into ${door.between}`);
});

test("a closed kitchen keeps its walls in every concept", () => {
  for (const c of CONCEPT_IDS) {
    const l = placeConcept(house, roomy, c, { closedKitchen: true })!;
    const k = l.floors[0].spaces.find((s) => s.kind === "kitchen")!;
    assert.equal(isOpen(k), false, c);
  }
});

/** Every floor with a bath has one that people reach without walking through a bedroom. */
function sharedBath(l: Layout, ctx: string) {
  for (const f of l.floors) {
    const baths = f.spaces.filter((s) => s.kind === "bath");
    if (!baths.length) continue;
    const kind = new Map(f.spaces.map((s) => [s.id, s.kind]));
    const start = f.spaces.filter((s) => s.zone === "circulation" || s.zone === "public").map((s) => s.id);
    const seen = new Set(start);
    const queue = [...start];
    while (queue.length) {
      const here = queue.shift()!;
      if (kind.get(here) === "bedroom") continue; // don't walk through someone's bedroom
      for (const o of f.openings)
        if (o.type === "door" && o.between.includes(here)) {
          const next = o.between[0] === here ? o.between[1] : o.between[0];
          if (next !== "outside" && !seen.has(next)) seen.add(next), queue.push(next);
        }
    }
    assert.ok(baths.some((b) => seen.has(b.id)), `${ctx}: floor ${f.level} has no bath reachable without a bedroom`);
  }
}

// ---- Fuzz: random homes and offices on random lots. The engine may say "doesn't fit", but it must never
// return a broken building, lose a room, or crash the 3D pipeline.

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function randomProgram(r: () => number): Program {
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const between = (a: number, b: number) => a + r() * (b - a);
  const spaceType = pick(["house", "apartment", "studio", "office", "cafe"] as const);
  const floors = r() < 0.5 ? 1 : 2;
  const rooms: ProgramRoom[] = [];
  const add = (kind: string, zone: ProgramRoom["zone"], area: number, floor: number) =>
    rooms.push({ id: `${kind}-${rooms.length}`, name: `${kind} ${rooms.length}`, kind, zone, area: Math.round(area), floor });
  const upper = () => (floors === 2 && r() < 0.8 ? 1 : 0);
  for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) add(pick(["living", "kitchen", "dining", "lounge"]), "public", between(8, 34), floors === 2 && r() < 0.15 ? 1 : 0);
  for (let i = 0, n = 1 + Math.floor(r() * 4); i < n; i++) add(pick(["bedroom", "bedroom", "office"]), "private", between(8, 22), upper());
  for (let i = 0, n = Math.floor(r() * 4); i < n; i++) add(pick(["bath", "bath", "laundry", "storage"]), "service", between(3, 8), upper());
  // Every floor needs a room.
  for (let f = 0; f < floors; f++) if (!rooms.some((x) => x.floor === f)) add("bedroom", "private", 12, f);
  return { spaceType, floors, rooms };
}

// FUZZ_N and FUZZ_SEED run a bigger hunt locally: FUZZ_N=5000 FUZZ_SEED=7 node --test lib/layout/concepts.test.ts
const FUZZ_N = Number(process.env.FUZZ_N ?? 600);
test(`fuzz: ${FUZZ_N} random programs on random lots never yield a broken plan`, () => {
  const r = rng(Number(process.env.FUZZ_SEED ?? 20261011));
  let tried = 0;
  let placed = 0;
  for (let i = 0; i < FUZZ_N; i++) {
    const program = randomProgram(r);
    const lot = { width: 8 + r() * 22, depth: 8 + r() * 22 };
    const shell = buildingShell(program, lot);
    let oldWorks = false;
    try {
      // The old engine's plan counts only if it also meets today's rules (stairwell, usable bedrooms).
      oldWorks = validate(place(program, shell)).length === 0;
    } catch {
      // the old engine couldn't fit it either
    }
    for (const c of CONCEPT_IDS) {
      tried++;
      const l = placeConcept(program, shell, c);
      if (!l) {
        assert.ok(!(c === "hall-street" && oldWorks), `case ${i}: hall-street lost a plan the old engine could make`);
        continue;
      }
      placed++;
      const ctx = `case ${i} ${program.spaceType} ${program.floors}F ${lot.width.toFixed(1)}x${lot.depth.toFixed(1)} ${c}`;
      assert.deepEqual(validate(l), [], ctx);
      placedOnce(l, program);
      sharedBath(l, ctx);
      assert.deepEqual(missingEssentials(l), [], `${ctx}: missing furniture`);
      // The 3D pipeline must handle every plan the engine accepts.
      for (const it of furnish(l)) {
        const room = l.floors[it.level].spaces.find((s) => s.id === it.room)!;
        assert.ok(Number.isFinite(it.x) && Number.isFinite(it.z), `${ctx}: ${it.name} position`);
        assert.ok(it.x >= room.rect.x - 1e-6 && it.x <= room.rect.x + room.rect.w + 1e-6, `${ctx}: ${it.name} inside ${room.id}`);
      }
      decorate(l);
      const walk = walkPlan(l);
      assert.ok(walk.path.every((p) => p.every(Number.isFinite)), `${ctx}: walk path`);
      assert.deepEqual(wallCrossings(l, walk.path), [], `${ctx}: walk goes through a wall`);
      for (const f of l.floors) blockers(l, f.level);
    }
  }
  // Most random homes should fit most concepts; a collapse here means a regression, not bad luck.
  assert.ok(placed / tried > 0.5, `only ${placed} of ${tried} placed`);
});

test("with one bath on the floor, it never opens only through a bedroom", () => {
  for (const c of CONCEPT_IDS) {
    const l = placeConcept(TEMPLATES.apartment, shellOf(TEMPLATES.apartment), c);
    if (!l) continue;
    const bath = l.floors[0].openings.find((o) => o.type === "door" && o.between[0] === "bath")!;
    const other = l.floors[0].spaces.find((s) => s.id === bath.between[1])!;
    assert.notEqual(other.kind, "bedroom", `${c}: the only bath opens into ${other.id}`);
  }
});

test("on a deep lot the front door still faces the street", () => {
  const lot = { width: 12.2, depth: 18.3 };
  const shell = buildingShell(house, lot);
  assert.ok(shell.depth > shell.width, "this is a deep footprint");
  for (const c of ["hall-street", "hall-garden", "great-room"] as const) {
    const l = placeConcept(house, shell, c);
    if (!l) continue;
    const entry = l.floors[0].openings.find((o) => o.id === "door-entry")!;
    assert.ok(entry.axis === "x" && Math.abs(entry.y) < 1e-6, `${c}: front door at ${entry.axis} ${entry.x.toFixed(2)},${entry.y.toFixed(2)}`);
  }
});
