"use client";

import { Bounds, Environment, Html, Lightformer, OrbitControls, PerformanceMonitor, useBounds } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Box3, BufferGeometry, CatmullRomCurve3, DoubleSide, Float32BufferAttribute, Plane, Raycaster, Vector2, Vector3, type Texture } from "three";
import type { Layout } from "@/lib/layout/schema";
import { decorate } from "@/lib/three/decor";
import { furnish, type Item } from "@/lib/three/furniture";
import { PIECES } from "@/lib/shop/list";
import { blockers, step } from "@/lib/three/explore";
import { buildSlabs, buildWalls, DOOR_H, EYE, onTour, stairBoxes, STOREY, walkPlan, WALL_H, type Glass, type Slab, type WallBox } from "@/lib/three/geometry";
import { look as lookOf, luminance, mix, scheme, type Look, type Scheme } from "@/lib/three/materials";
import { LookCtx, Model } from "./models";
import { brick, planks, plate, SIGN, signboard, tiled, tiledOnce, tiles } from "./textures";
import { exteriorOf, roofShape, type Exterior } from "@/lib/three/exterior";
import { fitMargin } from "@/lib/three/fit";
import { moodsFor, type Mood } from "@/lib/three/mood";
import { roomBell, step as playStep } from "@/components/fx/sfx";
import { SketchFx, SketchMaterial } from "./Sketch";

export type Mode = "walk" | "explore" | "orbit" | "showcase" | "shot";

type Props = {
  layout: Layout;
  /** Plants the client added to raise the greenery score, by room id. */
  extraPlants?: Record<string, number>;
  /** Called when a piece you can buy is clicked. */
  onPick?: (it: Item) => void;
  /** Look-around only: lift the roof off, and show floors up to this level ("all" keeps every floor). */
  cutaway?: boolean;
  upTo?: number | "all";
  /** The design brief and Qloo taste profile: colours, wall finish and furniture style come from these. */
  brief?: Parameters<typeof lookOf>[0];
  taste?: Parameters<typeof lookOf>[1];
  mode: Mode;
  /** Bump to frame the whole building again after flying into a room. */
  fitKey?: number;
  /** Explore mode: the floor you're on, a point to jump to, and where you are now. */
  level?: number;
  go?: { x: number; z: number; key: number };
  onPose?: (p: Pose) => void;
  playing: boolean;
  /** Stop drawing altogether, for a view scrolled out of sight. */
  paused?: boolean;
  onRoom?: (name: string) => void;
  onProgress?: (p: number) => void;
  onEnd?: () => void;
  restartKey?: number;
  /** The walk: where along it (0 to 1) each room is seen, and a place to jump the walk to. */
  onMarks?: (marks: { name: string; t: number }[]) => void;
  seek?: { t: number; key: number };
  /** Look-around only: turn slowly on its own until someone grabs it, and whether the mouse wheel zooms. */
  autoRotate?: boolean;
  wheelZoom?: boolean;
  /** Draw it as a hand sketch in the page's ink and blue, instead of in full colour; "print" puts it on white paper. */
  sketch?: boolean | "print";
  /** Shot mode: where the camera stands, and what to do with the finished picture (a PNG data URL). */
  shot?: Shot;
  /** A new build gets its roof shape from taste; a fit-out keeps a flat roof. */
  newBuild?: boolean;
  /** Night: a dark sky, moonlight, the rooms lit and the windows glowing. Never for sketches. */
  night?: boolean;
  onShot?: (png: string) => void;
  /** The project's name, for the nameplate by the front door. */
  name?: string | null;
};


/** Which face of an outside wall's box looks out of the building: +z or -z for a wall along x, +x or -x along z. */
function outerFace(w: WallBox, W: number, D: number) {
  return w.axis === "x" ? (w.at > D / 2 ? 4 : 5) : w.at > W / 2 ? 0 : 1;
}

function wallGeom(w: WallBox | Glass, thick: number) {
  const len = w.to - w.from;
  const h = w.y1 - w.y0;
  const mid = (w.from + w.to) / 2;
  const y = (w.y0 + w.y1) / 2;
  return w.axis === "x"
    ? { position: [mid, y, w.at] as const, size: [len, h, thick] as const }
    : { position: [w.at, y, mid] as const, size: [thick, h, len] as const };
}

// Triangles as one mesh, lit from both sides (a roof seen from inside the cutaway, a gable from either side).
function Triangles({ tris, color, map }: { tris: number[][][]; color: string; map?: Texture }) {
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(tris.flat(2), 3));
    // Planar UVs from x + z and y, so cladding runs the right way on the gable ends.
    g.setAttribute("uv", new Float32BufferAttribute(tris.flat().flatMap((p) => [(p[0] + p[2]) / 2.4, p[1] / 0.8]), 2));
    g.computeVertexNormals();
    return g;
  }, [tris]);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color={map ? "#ffffff" : color} map={map} roughness={0.85} side={DoubleSide} />
    </mesh>
  );
}

// A low hedge along the street side and a few trees in the garden, for a planted exterior.
function Garden({ W, D, colors, door }: { W: number; D: number; colors: Scheme; door: number }) {
  const shrubs = Math.max(4, Math.floor(W / 1.1));
  const trees: [number, number, number][] = [[-2.2, D * 0.25, 1.1], [W + 2.4, D * 0.6, 1.3], [W * 0.8, D + 2.6, 1.2], [-2, D + 1.8, 0.9]];
  return (
    <group>
      {/* rounded shrubs along the street side, leaving the path to the door clear */}
      {Array.from({ length: shrubs }, (_, i) => {
        const x = 0.4 + (i * (W - 0.8)) / (shrubs - 1);
        if (Math.abs(x - door) < 1.3) return null;
        const r = 0.38 + ((i * 37) % 10) / 50;
        return (
          <mesh key={i} position={[x, r * 0.8, -1.4]} scale={[1, 0.85, 1]} castShadow>
            <sphereGeometry args={[r, 14, 10]} />
            <meshStandardMaterial color={mix(colors.plant, "#2f5d2a", (i % 3) * 0.2)} roughness={1} />
          </mesh>
        );
      })}
      {trees.map(([x, z, r], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.16, 2, 8]} />
            <meshStandardMaterial color="#6b4f3a" roughness={1} />
          </mesh>
          <mesh position={[0, 2.4 + r * 0.4, 0]} castShadow>
            <sphereGeometry args={[r, 14, 12]} />
            <meshStandardMaterial color={mix(colors.plant, "#2f5d2a", (i % 2) * 0.35)} roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// A café's lighting, designed rather than one lamp a room: a coloured glass pendant low over every table, opal globes
// along the counter, a neon cup glowing on the back bar, and an LED cove along the top of the walls that runs from rose
// through violet to teal, with a wash of the same colours in the corners. By night they light the room (a few real
// lights, the rest glow); by day they're just fittings.
const PENDANTS = ["#ffb347", "#ff6f9f", "#4fd8e0", "#b08cff", "#ffd45c"];
const COVE = ["#ff5fa2", "#a46bff", "#3fd6e6"];
function Glow({ color, on, power = 3 }: { color: string; on: boolean; power?: number }) {
  return <meshStandardMaterial color={color} emissive={color} emissiveIntensity={on ? power : 0.25} toneMapped={!on} />;
}
/** A colour between the cove's three, from 0 to 1. */
function coveAt(t: number) {
  const x = Math.min(0.999, Math.max(0, t)) * (COVE.length - 1);
  return mix(COVE[Math.floor(x)], COVE[Math.floor(x) + 1], x - Math.floor(x));
}
function CafeLights({ items, slabs, night, cutaway }: { items: Item[]; slabs: Slab[]; night: boolean; cutaway: boolean }) {
  const tables = items.filter((i) => i.name === "cafe table");
  const counter = items.find((i) => i.name === "service counter");
  const bar = counter && items.find((i) => i.name === "shelving" && i.room === counter.room);
  const rooms = slabs.filter((s) => tables.some((t) => t.room === s.id));
  // The cove: short glowing lengths around each room's walls, just under the ceiling, the colour moving round the room.
  const cove = rooms.flatMap((s) => {
    // under the ceiling; with the walls cut open it runs along their cut tops instead, outlining the room
    const y = s.y + (cutaway ? CUT + 0.02 : WALL_H - 0.08);
    const edges: [number, number, number, number][] = [
      [s.x, s.z + 0.08, s.x + s.w, s.z + 0.08],
      [s.x + s.w - 0.08, s.z, s.x + s.w - 0.08, s.z + s.d],
      [s.x + s.w, s.z + s.d - 0.08, s.x, s.z + s.d - 0.08],
      [s.x + 0.08, s.z + s.d, s.x + 0.08, s.z],
    ];
    const perimeter = 2 * (s.w + s.d);
    let run = 0;
    return edges.flatMap(([x0, z0, x1, z1]) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 0.5));
      return Array.from({ length: n }, (_, i) => {
        const f = (i + 0.5) / n;
        const piece = { x: x0 + (x1 - x0) * f, y, z: z0 + (z1 - z0) * f, along: x0 === x1 ? "z" : "x", len: len / n - 0.02, c: coveAt((run + f * len) / perimeter) };
        if (i === n - 1) run += len;
        return piece;
      });
    });
  });
  const along = (it: Item, f: number): [number, number] => [it.x + Math.cos(it.rot) * f, it.z - Math.sin(it.rot) * f];
  return (
    <group>
      {tables.map((t, i) => {
        const c = PENDANTS[i % PENDANTS.length];
        return (
          <group key={`p-${i}`} position={[t.x, t.y, t.z]}>
            <mesh position={[0, (WALL_H + 1.9) / 2, 0]}>
              <cylinderGeometry args={[0.006, 0.006, WALL_H - 1.9, 4]} />
              <meshStandardMaterial color="#1b1b1b" />
            </mesh>
            {/* a glass globe in its own colour, a brass cap above it */}
            <mesh position={[0, 1.9, 0]}>
              <cylinderGeometry args={[0.03, 0.05, 0.05, 12]} />
              <meshStandardMaterial color="#c9a46a" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0, 1.78, 0]}>
              <sphereGeometry args={[0.12, 20, 16]} />
              <Glow color={c} on={night} power={3.2} />
            </mesh>
            {night && i % 2 === 0 && <pointLight position={[0, 1.55, 0]} intensity={3} distance={3.6} decay={1.6} color={c} />}
          </group>
        );
      })}
      {counter &&
        [-0.33, 0, 0.33].map((f) => {
          const [x, z] = along(counter, f * counter.lw);
          return (
            <group key={`g-${f}`} position={[x, counter.y, z]}>
              <mesh position={[0, (WALL_H + 2.1) / 2, 0]}>
                <cylinderGeometry args={[0.006, 0.006, WALL_H - 2.1, 4]} />
                <meshStandardMaterial color="#1b1b1b" />
              </mesh>
              <mesh position={[0, 1.98, 0]}>
                <sphereGeometry args={[0.13, 20, 16]} />
                <Glow color="#ffe6bf" on={night} power={2.4} />
              </mesh>
            </group>
          );
        })}
      {counter && night && <pointLight position={[counter.x, counter.y + 1.8, counter.z]} intensity={4} distance={4.5} decay={1.5} color="#ffd9a8" />}
      {/* the neon on the back bar: a cup with steam rising, pink and blue */}
      {bar && (
        <group position={[bar.x + Math.sin(bar.rot) * 0.06, bar.y + 2.35, bar.z + Math.cos(bar.rot) * 0.06]} rotation-y={bar.rot}>
          <mesh rotation-z={Math.PI}>
            <torusGeometry args={[0.2, 0.022, 8, 32, Math.PI]} />
            <Glow color="#ff4f9a" on={night} power={6} />
          </mesh>
          {[-0.2, 0.2].map((x) => (
            <mesh key={x} position={[x, 0.04, 0]}>
              <boxGeometry args={[0.044, 0.08, 0.044]} />
              <Glow color="#ff4f9a" on={night} power={6} />
            </mesh>
          ))}
          <mesh position={[0.29, -0.06, 0]}>
            <torusGeometry args={[0.07, 0.018, 8, 20, Math.PI]} />
            <Glow color="#ff4f9a" on={night} power={6} />
          </mesh>
          {[-0.08, 0.06].map((x) => (
            <mesh key={x} position={[x, 0.26, 0]} rotation-z={Math.PI / 2}>
              <torusGeometry args={[0.09, 0.015, 8, 20, Math.PI]} />
              <Glow color="#4fe3ff" on={night} power={6} />
            </mesh>
          ))}
          {night && <pointLight position={[0, 0, 0.5]} intensity={2.5} distance={3.5} decay={1.6} color="#ff6fb0" />}
        </group>
      )}
      {cove.map((c, i) => (
        <mesh key={`c-${i}`} position={[c.x, c.y, c.z]}>
          <boxGeometry args={c.along === "x" ? [c.len, 0.035, 0.035] : [0.035, 0.035, c.len]} />
          <Glow color={c.c} on={night} power={4} />
        </mesh>
      ))}
      {/* the cove's colours washing down the walls from the corners */}
      {night &&
        rooms.flatMap((s) =>
          [
            [s.x + 0.3, s.z + 0.3, 0],
            [s.x + s.w - 0.3, s.z + s.d - 0.3, 1],
          ].map(([x, z, k]) => <pointLight key={`w-${s.id}-${k}`} position={[x, s.y + WALL_H - 0.3, z]} intensity={2.2} distance={4} decay={1.5} color={k ? COVE[2] : COVE[0]} />),
        )}
    </group>
  );
}

// The way in: the front door (open, so the walk goes through), a slim canopy over it, a light either side, a step and
// a stone path out to the street. Doors on the street side face -z; one on the side faces -x.
function Entrance({ layout, walking, name, night = false }: { layout: Layout; walking: boolean; name?: string | null; night?: boolean }) {
  const d = layout.floors[0]?.openings.find((o) => o.id === "door-entry");
  if (!d) return null;
  const front = d.axis === "x";
  const w = d.width;
  return (
    <group position={[d.x, 0, d.y]} rotation={[0, front ? 0 : Math.PI / 2, 0]}>
      {/* the door leaf, swung open into the hall against the wall (left out on a walk, which passes right by it) */}
      {!walking && <group position={[-w / 2 + 0.03, 0, 0.06]} rotation={[0, -1.55, 0]}>
        <mesh position={[(w - 0.08) / 2, DOOR_H / 2, 0]} castShadow>
          <boxGeometry args={[w - 0.08, DOOR_H - 0.02, 0.04]} />
          <meshStandardMaterial color="#9c7a58" roughness={0.55} />
        </mesh>
        <mesh position={[w - 0.2, 1.0, 0.04]}>
          <boxGeometry args={[0.03, 0.35, 0.03]} />
          <meshStandardMaterial color="#c9a46a" roughness={0.3} metalness={0.8} />
        </mesh>
      </group>}
      {/* canopy and lights */}
      <mesh position={[0, DOOR_H + 0.28, -0.55]} castShadow>
        <boxGeometry args={[w + 1.2, 0.08, 1.0]} />
        {/* a warm timber soffit, seen from below as you walk in */}
        <meshStandardMaterial color="#a8835e" roughness={0.6} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (w / 2 + 0.35), 1.85, -0.13]}>
          <boxGeometry args={[0.1, 0.28, 0.08]} />
          <meshStandardMaterial color="#fff1d6" emissive="#ffd9a0" emissiveIntensity={1.1} />
        </mesh>
      ))}
      {/* a café's sign: a long board over the door with its name, lit from within at night */}
      {name && layout.spaceType === "cafe" && (
        <group position={[0, DOOR_H + 0.95, -0.14]}>
          <mesh>
            <boxGeometry args={[0.7 * SIGN, 0.7, 0.08]} />
            <meshStandardMaterial attach="material-0" color="#1f2a24" />
            <meshStandardMaterial attach="material-1" color="#1f2a24" />
            <meshStandardMaterial attach="material-2" color="#1f2a24" />
            <meshStandardMaterial attach="material-3" color="#1f2a24" />
            <meshStandardMaterial attach="material-4" color="#1f2a24" />
            <meshStandardMaterial attach="material-5" map={signboard(name)} emissive="#ffffff" emissiveMap={signboard(name)} emissiveIntensity={night ? 0.9 : 0.12} roughness={0.5} />
          </mesh>
          {/* two small lamps bending over it */}
          {[-1, 1].map((sx) => (
            <group key={sx} position={[sx * 0.7 * SIGN * 0.32, 0.5, -0.25]}>
              <mesh rotation-x={0.6}>
                <coneGeometry args={[0.09, 0.14, 16, 1, true]} />
                <meshStandardMaterial color="#1b1b1b" metalness={0.6} roughness={0.4} side={DoubleSide} />
              </mesh>
              {night && <spotLight position={[0, 0, 0]} target-position={[0, -0.8, 0.4]} angle={0.7} penumbra={0.6} intensity={6} distance={3} color="#ffd9a0" />}
            </group>
          ))}
        </group>
      )}
      {/* the nameplate beside the door: a house number from the plan, and the project's name */}
      {name && layout.spaceType !== "cafe" && (
        <mesh position={[-(w / 2 + 0.5), 1.45, -0.115]}>
          <boxGeometry args={[0.36, 0.36, 0.02]} />
          <meshStandardMaterial attach="material-0" color="#23262b" />
          <meshStandardMaterial attach="material-1" color="#23262b" />
          <meshStandardMaterial attach="material-2" color="#23262b" />
          <meshStandardMaterial attach="material-3" color="#23262b" />
          <meshStandardMaterial attach="material-4" color="#23262b" />
          <meshStandardMaterial attach="material-5" map={plate(String(1000 + (Math.round(layout.shell.width * 37 + layout.shell.depth * 11) % 900)), name)} roughness={0.4} metalness={0.2} />
        </mesh>
      )}
      {/* a step and the path */}
      <mesh position={[0, 0.06, -0.45]} receiveShadow castShadow>
        <boxGeometry args={[w + 0.8, 0.12, 0.7]} />
        <meshStandardMaterial color="#cfc8bb" roughness={0.9} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[0, 0.012, -1.15 - i * 0.75]} receiveShadow>
          <boxGeometry args={[1.3, 0.025, 0.62]} />
          <meshStandardMaterial color="#d9d3c7" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Building({ layout, colors, look, ex, moods = {}, night = false, cutaway = false, upTo = "all", extraPlants, onPick, walking = false, name }: { layout: Layout; colors: Scheme; look: Look; ex: Exterior; moods?: Record<string, Mood>; night?: boolean; cutaway?: boolean; upTo?: number | "all"; extraPlants?: Record<string, number>; onPick?: (it: Item) => void; walking?: boolean; name?: string | null }) {
  const shown = (level: number) => upTo === "all" || level <= upTo;
  // Show inside cuts the top floor's walls at 1.4 m, like an architect's section, so every room reads from above.
  const topShown = upTo === "all" ? (layout.floors.at(-1)?.level ?? 0) : upTo;
  const cutAt = (level: number) => (cutaway && level === topShown ? level * STOREY + CUT : Infinity);
  const built = useMemo(() => buildWalls(layout), [layout]);
  const walls = built.walls
    .filter((w) => shown(w.level) && w.y0 < cutAt(w.level))
    .map((w) => ({ ...w, y1: Math.min(w.y1, cutAt(w.level)), cut: w.y1 > cutAt(w.level) }));
  const glass = built.glass.filter((g) => shown(g.level) && g.y0 < cutAt(g.level)).map((g) => ({ ...g, y1: Math.min(g.y1, cutAt(g.level)) }));
  const allSlabs = useMemo(() => buildSlabs(layout), [layout]);
  const slabs = allSlabs.filter((s) => shown(s.level) && !(s.kind === "stairs" && s.level > 0));
  const allItems = useMemo(() => [...furnish(layout, { lush: look.lush, extraPlants }), ...decorate(layout)], [layout, look.lush, extraPlants]);
  const items = allItems
    .filter((i) => shown(i.level))
    .flatMap((it) => {
      const c = cutAt(it.level);
      if (!WALL_DRESSING.has(it.name) || it.y + it.h <= c) return [it];
      if (it.name === "art" || it.y >= c) return [];
      return [{ ...it, h: c - it.y }];
    });
  const { width: W, depth: D } = layout.shell;
  const top = (layout.floors.length - 1) * STOREY + WALL_H;
  const skirting = mix(colors.wall, "#000000", 0.1);
  // Outside walls in the cladding the taste chose: brick, timber boards or plain render.
  const clad = useMemo(() => (ex.cladding === "brick" ? brick("#9a5a43") : ex.cladding === "timber" ? planks(mix(colors.wood, "#6b4a32", 0.25)) : null), [ex.cladding, colors.wood]);
  const roof = useMemo(() => roofShape(ex, W, D, top), [ex, W, D, top]);
  // Render is a warm white, so slim dark window frames read crisply against it.
  const render = mix(colors.exterior, "#f3efe8", 0.65);
  const frame = ex.cladding !== "render" && luminance(colors.exterior) <= 0.6 ? "#f1efea" : "#2b2d31";
  return (
    <group>
      {/* floors: wood planks, tile in wet rooms, on a slab */}
      {slabs.map((s) => (
        <group key={`f-${s.level}-${s.id}`}>
          <mesh position={[s.x + s.w / 2, s.y - 0.06, s.z + s.d / 2]} receiveShadow>
            <boxGeometry args={[s.w, 0.12, s.d]} />
            {/* the slab's edge shows on the outside between floors: render-coloured, not a dark stripe */}
            <meshStandardMaterial color={render} roughness={0.9} />
          </mesh>
          <Floor s={s} colors={colors} look={look} />
        </group>
      ))}
      {layout.floors
        .filter((f) => f.level > 0 && !cutaway && shown(f.level))
        .map((f) => (
          <mesh key={`ceil-${f.level}`} position={[W / 2, f.level * STOREY - (STOREY - WALL_H) / 2 - 0.12, D / 2]}>
            <boxGeometry args={[W, STOREY - WALL_H, D]} />
            <meshStandardMaterial color={colors.wall} />
          </mesh>
        ))}
      {/* walls, with a skirting board along the foot of each */}
      {walls.map((w, i) => {
        const g = wallGeom(w, w.thick);
        const foot = Math.abs(w.y0 - w.level * STOREY) < 1e-6;
        const k = wallGeom({ ...w, y1: w.y0 + 0.09 }, w.thick + 0.025);
        return (
          <group key={`w-${i}`}>
            <mesh position={g.position} castShadow receiveShadow>
              <boxGeometry args={g.size} />
              {/* An outside wall is clad on its outside face only; the room side is painted like every inside wall.
                  A box's faces run +x, -x, +y, -y, +z, -z. */}
              {[0, 1, 2, 3, 4, 5].map((f) =>
                w.exterior && f === outerFace(w, W, D) ? (
                  clad ? (
                    <meshStandardMaterial key={f} attach={`material-${f}`} map={tiledOnce(clad, Math.abs(w.to - w.from), w.y1 - w.y0, ex.cladding === "brick" ? 1.2 : 2.4, ex.cladding === "brick" ? 0.6 : 0.8)} roughness={0.92} />
                  ) : (
                    <meshStandardMaterial key={f} attach={`material-${f}`} color={render} roughness={0.92} />
                  )
                ) : (
                  <meshStandardMaterial key={f} attach={`material-${f}`} color={colors.wall} roughness={0.92} />
                ),
              )}
            </mesh>
            {w.cut && (
              // the top of a wall cut for the section view: a pale cap, so the plan reads like a drawing, not a black outline
              <mesh position={[g.position[0], w.y1 + 0.01, g.position[2]]}>
                <boxGeometry args={[g.size[0] + 0.001, 0.02, g.size[2] + 0.001]} />
                <meshStandardMaterial color={mix(colors.wall, "#d8d2c8", 0.5)} roughness={0.8} />
              </mesh>
            )}
            {foot && (
              <mesh position={k.position}>
                <boxGeometry args={k.size} />
                <meshStandardMaterial color={skirting} roughness={0.6} />
              </mesh>
            )}
          </group>
        );
      })}
      {/* windows: glass in a slim frame, with a centre bar on wide ones */}
      {glass.map((gl, i) => {
        const g = wallGeom(gl, 0.03);
        const bars: Glass[] = [
          { ...gl, to: gl.from + 0.05 },
          { ...gl, from: gl.to - 0.05 },
          { ...gl, y1: gl.y0 + 0.05 },
          { ...gl, y0: gl.y1 - 0.05 },
          ...(gl.to - gl.from > 1.2 ? [{ ...gl, from: (gl.from + gl.to) / 2 - 0.025, to: (gl.from + gl.to) / 2 + 0.025 }] : []),
        ];
        return (
          <group key={`g-${i}`}>
            <mesh position={g.position}>
              <boxGeometry args={g.size} />
              <meshPhysicalMaterial color={night ? "#ffd08a" : "#cfe3f5"} emissive={night ? "#ffb85c" : "#000000"} emissiveIntensity={night ? 0.9 : 0} transparent opacity={night ? 0.55 : 0.22} roughness={0.03} metalness={0.1} />
            </mesh>
            {bars.map((b, j) => {
              const f = wallGeom(b, 0.08);
              return (
                <mesh key={j} position={f.position} castShadow>
                  <boxGeometry args={f.size} />
                  <meshStandardMaterial color={frame} roughness={0.5} metalness={0.3} />
                </mesh>
              );
            })}
          </group>
        );
      })}
      {/* a turning stair in its stairwell: a flight beside the hall, a landing, a flight back up */}
      {layout.floors.length > 1 &&
        layout.floors[0].spaces
          .filter((s) => s.kind === "stairs")
          .flatMap((s) =>
            stairBoxes(s.rect, layout.floors[0].openings.find((o) => o.id === "door-stairs"))
              // In the section view the stair is cut at the same height as the walls.
              .filter((b) => !(cutaway && topShown === 0 && b.y + b.h > CUT) && !(!shown(1) && b.y + b.h > WALL_H))
              .map((b, i) => {
                // Each step is a tread 22 cm thick (an open, floating stair), so both flights and the landings read.
                const t = Math.min(b.h, 0.22);
                return (
                  <mesh key={`st-${s.id}-${i}`} position={[b.x, b.y + b.h - t / 2, b.z]} castShadow receiveShadow>
                    <boxGeometry args={[b.w, t, b.d]} />
                    <meshStandardMaterial color={colors.wood} roughness={0.6} />
                  </mesh>
                );
              }),
          )}
      {/* roof with a small overhang, lifted off in the cutaway view */}
      {!cutaway && upTo === "all" &&
        (ex.roof === "flat" ? (
          <mesh position={[W / 2, top + 0.15, D / 2]} castShadow>
            <boxGeometry args={[W + 0.6, 0.3, D + 0.6]} />
            <meshStandardMaterial color={ROOF_COLOR.flat} roughness={0.8} />
          </mesh>
        ) : (
          <>
            <Triangles tris={roof.roof} color={ROOF_COLOR[ex.roof]} />
            <Triangles tris={roof.infill} color={render} map={clad ?? undefined} />
          </>
        ))}
      {!cutaway && <Entrance layout={layout} walking={walking} name={name} night={night} />}
      {ex.garden && <Garden W={W} D={D} colors={colors} door={layout.floors[0]?.openings.find((o) => o.id === "door-entry" && o.axis === "x")?.x ?? -99} />}
      {items.map((it, i) =>
        onPick && PIECES[it.name] ? (
          // A piece you can buy: click it to see the brand it comes from.
          <group
            key={`i-${i}`}
            onClick={(e) => {
              e.stopPropagation();
              onPick(it);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => (document.body.style.cursor = "")}
          >
            <Model it={it} k={colors} />
          </group>
        ) : (
          <Model key={`i-${i}`} it={it} k={colors} />
        ),
      )}
      {layout.spaceType === "cafe" && <CafeLights items={items} slabs={slabs} night={night} cutaway={cutaway} />}
      {/* a warm light in every room, with its fixture on the ceiling when the roof is on */}
      {slabs
        .filter((s) => s.zone !== "circulation")
        .slice(0, 12)
        .map((s) => (
          <group key={`l-${s.level}-${s.id}`} position={[s.x + s.w / 2, s.y + WALL_H, s.z + s.d / 2]}>
            {/* each room lit for its mood: warm and low, bright and even, or soft (Q7) */}
            <pointLight position={[0, -0.45, 0]} intensity={(night ? 6 : 2.6) * (moods[s.id]?.light.strength ?? 1)} distance={night ? 9 : 7} decay={1.4} color={moods[s.id]?.light.color ?? "#ffe6c4"} />
            {!cutaway && (
              <mesh position={[0, -0.02, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 0.03, 24]} />
                <meshStandardMaterial color="#fff6e8" emissive="#fff1d6" emissiveIntensity={1.2} />
              </mesh>
            )}
          </group>
        ))}
    </group>
  );
}

const WET = new Set(["bath", "laundry"]);
// What a roof is made of, not a colour from the palette (a navy palette made a navy roof): slate on a pitched roof,
// standing-seam metal on a single slope, pale membrane on a flat one.
const ROOF_COLOR = { hip: "#5b6168", gable: "#5b6168", shed: "#6e7277", flat: "#c4c0b8" } as const;
const CUT = 1.4;
// Floor boards lean toward the style: pale oak for Scandinavian, smoky for industrial; boards are 20 cm by 2.7 m.
// (natural oak for most styles, so the floors read calm and modern rather than red)
const FLOOR_TONE = { scandi: ["#e6d7bd", 0.6], modern: ["#c9ad86", 0.6], boho: ["#c9a77c", 0.45], industrial: ["#7d7468", 0.45], classic: ["#9a7652", 0.6], midcentury: ["#a87b52", 0.5] } as const;
const WALL_DRESSING = new Set(["feature wall", "art", "backsplash", "tile", "curtain", "curtain rod", "wainscot"]);
function Floor({ s, colors, look }: { s: Slab; colors: Scheme; look: Look }) {
  const wet = WET.has(s.kind);
  const map = useMemo(
    () => (wet ? tiled(tiles(mix(look.tile, "#888888", 0.15), look.tileKind === "zellige" ? "plain" : look.tileKind, 2), s.w, s.d, 0.6) : tiled(planks(mix(colors.floor, FLOOR_TONE[look.style][0], FLOOR_TONE[look.style][1])), s.w, s.d, 3.6, 0.8)),
    [wet, s.w, s.d, colors.floor, look.tile, look.tileKind, look.style],
  );
  return (
    <mesh rotation-x={-Math.PI / 2} position={[s.x + s.w / 2, s.y + 0.001, s.z + s.d / 2]} receiveShadow>
      <planeGeometry args={[s.w, s.d]} />
      <meshStandardMaterial map={map} roughness={wet ? 0.35 : 0.55} />
    </mesh>
  );
}

// Moves the camera along the walk path at walking pace, looking where it's going.
function Walker({ layout, playing, onRoom, onProgress, onEnd, restartKey, onMarks, seek }: Omit<Props, "mode" | "brief" | "taste">) {
  const { camera } = useThree();
  const curves = useMemo(() => {
    const { path, gaze, stops } = walkPlan(layout);
    if (path.length < 2) return null;
    const mk = (pts: number[][]) => new CatmullRomCurve3(pts.map((p) => new Vector3(p[0], p[1], p[2])), false, "centripetal", 0.5);
    return { path: mk(path), gaze: mk(gaze), stops: stops.map((p) => new Vector3(p[0], p[1], p[2])) };
  }, [layout]);
  const length = useMemo(() => curves?.path.getLength() ?? 1, [curves]);
  const t = useRef(0);
  const look = useRef(new Vector3());
  const lastRoom = useRef("");
  const ended = useRef(false);
  const { gl } = useThree();
  // Mouse look while walking: drag to turn your head; let go and the view eases back to the path.
  const head = useRef({ yaw: 0, pitch: 0, dragging: false, x: 0, y: 0 });
  const stepClock = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => Object.assign(head.current, { dragging: true, x: e.clientX, y: e.clientY });
    const move = (e: PointerEvent) => {
      const h = head.current;
      if (!h.dragging) return;
      h.yaw -= (e.clientX - h.x) * 0.005;
      h.pitch = Math.max(-0.9, Math.min(0.9, h.pitch - (e.clientY - h.y) * 0.004));
      h.x = e.clientX;
      h.y = e.clientY;
    };
    const up = () => {
      head.current.dragging = false;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.style.cursor = "grab";
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.style.cursor = "";
    };
  }, [gl]);

  // Each room the walk stops to look at, and how far along the walk that is: the walk's chapters.
  useEffect(() => {
    if (!curves || !onMarks) return;
    const samples = Array.from({ length: 400 }, (_, i) => curves.path.getPointAt(i / 399));
    const marks: { name: string; t: number }[] = [];
    for (const p of curves.stops) {
      const level = Math.round((p.y - EYE) / STOREY);
      const room = layout.floors.find((f) => f.level === level)?.spaces.find((s) => s.zone !== "circulation" && p.x >= s.rect.x && p.x <= s.rect.x + s.rect.w && p.z >= s.rect.y && p.z <= s.rect.y + s.rect.h);
      if (!room || marks.some((m) => m.name === room.name)) continue;
      let best = 0;
      samples.forEach((q, i) => q.distanceTo(p) < samples[best].distanceTo(p) && (best = i));
      // a moment before the stop, so the room is seen arriving
      marks.push({ name: room.name, t: Math.max(0, best / 399 - 0.02) });
    }
    onMarks(marks.sort((a, b) => a.t - b.t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curves, layout]);
  useEffect(() => {
    if (!seek) return;
    t.current = seek.t;
    ended.current = false;
  }, [seek]);

  useEffect(() => {
    t.current = 0;
    ended.current = false;
    if (curves) {
      camera.position.copy(curves.path.getPointAt(0));
      look.current.copy(curves.gaze.getPointAt(0));
    }
  }, [curves, camera, restartKey]);

  useFrame((_, frameDt) => {
    if (!curves) return;
    // A slow frame must not jump the walk ahead: cap the step to a tenth of a second.
    const dt = Math.min(frameDt, 0.1);
    // Walk briskly, slowing at each doorway view so the room can be taken in.
    const here0 = curves.path.getPointAt(t.current);
    const near = Math.min(...curves.stops.map((p) => p.distanceTo(here0)), 99);
    // brisk, with a short pause at each room (Vicky: the walk felt long)
    const pace = 1.3 * Math.min(1, Math.max(0.16, near / 1.6));
    const h = head.current;
    // Holding the mouse down pauses the walk so you can look around where you stand.
    const walking = playing && t.current < 1 && !h.dragging;
    if (walking) {
      t.current = Math.min(1, t.current + (dt * pace) / length);
      // A footstep about every 0.7 m.
      stepClock.current += dt * pace;
      if (stepClock.current > 0.7 && pace > 0.3) {
        stepClock.current = 0;
        playStep();
      }
    }
    if (!h.dragging) {
      h.yaw *= 1 - Math.min(1, dt * 1.5);
      h.pitch *= 1 - Math.min(1, dt * 1.5);
    }
    // Even walking speed along the path; the gaze follows the same control point, so each look matches its spot.
    const u = curves.path.getUtoTmapping(t.current, 0);
    const pos = curves.path.getPoint(u);
    const target = curves.gaze.getPoint(u);
    camera.position.copy(pos);
    look.current.lerp(target, Math.min(1, dt * 2.2));
    // Turn the head by the drag: rotate the look direction around the eye.
    const dir = look.current.clone().sub(pos);
    const flat = Math.hypot(dir.x, dir.z) || 1;
    const yaw0 = Math.atan2(dir.x, dir.z) + h.yaw;
    const pitch0 = Math.atan2(dir.y, flat) + h.pitch;
    camera.lookAt(pos.x + Math.sin(yaw0) * Math.cos(pitch0), pos.y + Math.sin(pitch0), pos.z + Math.cos(yaw0) * Math.cos(pitch0));
    onProgress?.(t.current);
    const level = Math.round((pos.y - 1.6) / STOREY);
    const here = layout.floors
      .find((f) => f.level === level)
      ?.spaces.find((s) => pos.x >= s.rect.x && pos.x <= s.rect.x + s.rect.w && pos.z >= s.rect.y && pos.z <= s.rect.y + s.rect.h);
    const name = here ? (here.zone === "circulation" ? (here.kind === "stairs" ? "Stairs" : "Hall") : here.name) : "Outside";
    if (name !== lastRoom.current) {
      if (lastRoom.current && here && here.zone !== "circulation") roomBell();
      lastRoom.current = name;
      onRoom?.(name);
    }
    if (t.current >= 1 && !ended.current) {
      ended.current = true;
      onEnd?.();
    }
  });
  return null;
}

export type Pose = { x: number; z: number; yaw: number; level: number };

// Free walking at eye height: W A S D or the arrow keys to move, drag to look, click the floor to walk
// there. Walls stop you; doorways let you through. `go` jumps to a point (from the mini-map).
function Explorer({ layout, level, go, onPose, onRoom }: { layout: Layout; level: number; go?: { x: number; z: number; key: number }; onPose?: (p: Pose) => void; onRoom?: (name: string) => void }) {
  const { camera, gl } = useThree();
  const walls = useMemo(() => blockers(layout, level), [layout, level]);
  const me = useRef({ x: 0, z: 0, yaw: 0, pitch: -0.05 });
  const target = useRef<[number, number] | null>(null);
  const keys = useRef(new Set<string>());
  const lastPose = useRef(0);
  const lastRoom = useRef("");
  const stepClock = useRef(0);

  // Arrive on a floor in its first proper room, looking across it.
  useLayoutEffect(() => {
    const f = layout.floors.find((fl) => fl.level === level);
    const room = f?.spaces.find((s) => s.zone !== "circulation" && onTour(s)) ?? f?.spaces[0];
    if (!room) return;
    const { x, y, w, h } = room.rect;
    me.current = { x: x + w / 2, z: y + h - 0.6, yaw: Math.PI, pitch: -0.05 };
    target.current = null;
    if ("fov" in camera) {
      camera.fov = 72;
      camera.near = 0.05;
      camera.updateProjectionMatrix();
    }
  }, [layout, level, camera]);

  useEffect(() => {
    if (!go?.key) return;
    me.current.x = go.x;
    me.current.z = go.z;
    target.current = null;
  }, [go]);

  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number; moved: number; lx: number; ly: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, moved: 0, lx: e.clientX, ly: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - down.lx;
      const dy = e.clientY - down.ly;
      down.moved += Math.abs(dx) + Math.abs(dy);
      down.lx = e.clientX;
      down.ly = e.clientY;
      me.current.yaw -= dx * 0.005;
      me.current.pitch = Math.max(-1.1, Math.min(0.9, me.current.pitch - dy * 0.004));
    };
    const onUp = (e: PointerEvent) => {
      // A click (not a drag) walks to the spot on the floor under the pointer.
      if (down && down.moved < 6) {
        const r = el.getBoundingClientRect();
        const ndc = new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        const ray = new Raycaster();
        ray.setFromCamera(ndc, camera);
        const hit = ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -level * STOREY), new Vector3());
        if (hit && hit.distanceTo(camera.position) < 25) target.current = [hit.x, hit.z];
      }
      down = null;
    };
    const keyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        e.preventDefault();
        keys.current.add(k);
        target.current = null;
      }
    };
    const keyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    el.style.cursor = "crosshair";
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      el.style.cursor = "";
    };
  }, [gl, camera, level]);

  useFrame((_, frameDt) => {
    const dt = Math.min(frameDt, 0.1);
    const m = me.current;
    const k = keys.current;
    const turn = (k.has("arrowleft") || k.has("q") ? 1 : 0) - (k.has("arrowright") || k.has("e") ? 1 : 0);
    m.yaw += turn * dt * 1.6;
    const fwd = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
    const side = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
    let dx = 0;
    let dz = 0;
    const speed = 1.6;
    if (fwd || side) {
      dx = (Math.sin(m.yaw) * fwd - Math.cos(m.yaw) * side) * speed * dt;
      dz = (Math.cos(m.yaw) * fwd + Math.sin(m.yaw) * side) * speed * dt;
    } else if (target.current) {
      const [tx, tz] = target.current;
      const dist = Math.hypot(tx - m.x, tz - m.z);
      if (dist < 0.08) target.current = null;
      else {
        const s = Math.min(dist, speed * dt);
        dx = ((tx - m.x) / dist) * s;
        dz = ((tz - m.z) / dist) * s;
        // Turn gently toward where we're walking.
        const want = Math.atan2(tx - m.x, tz - m.z);
        let diff = want - m.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        m.yaw += diff * Math.min(1, dt * 3);
      }
    }
    if (dx || dz) {
      const [nx, nz] = step(m.x, m.z, dx, dz, walls);
      const moved = Math.hypot(nx - m.x, nz - m.z);
      if (target.current && moved < 1e-4) target.current = null; // walked into a wall: stop
      m.x = nx;
      m.z = nz;
      stepClock.current += moved;
      if (stepClock.current > 0.7) {
        stepClock.current = 0;
        playStep();
      }
    }
    const y = level * STOREY + EYE;
    camera.position.set(m.x, y, m.z);
    camera.lookAt(m.x + Math.sin(m.yaw) * Math.cos(m.pitch), y + Math.sin(m.pitch), m.z + Math.cos(m.yaw) * Math.cos(m.pitch));
    const now = performance.now();
    if (now - lastPose.current > 120) {
      lastPose.current = now;
      onPose?.({ x: m.x, z: m.z, yaw: m.yaw, level });
      const here = layout.floors.find((f) => f.level === level)?.spaces.find((s) => m.x >= s.rect.x && m.x <= s.rect.x + s.rect.w && m.z >= s.rect.y && m.z <= s.rect.y + s.rect.h);
      const name = here ? (here.zone === "circulation" ? (here.kind === "stairs" ? "Stairs" : "Hall") : here.name) : "Outside";
      if (name !== lastRoom.current) {
        if (lastRoom.current && here && here.zone !== "circulation") roomBell();
        lastRoom.current = name;
        onRoom?.(name);
      }
    }
  });
  return null;
}

// Look-around view: start from above the corner of the building with a normal lens. Runs as a layout
// effect so the camera is in place before Bounds frames the model from this direction.
/**
 * A fixed camera for a picture: which way it looks from (radians round the building, 0 = from the right, -π/2 = from
 * the street), how steeply it looks down (radians above the horizon), and what it frames: the whole building, one
 * floor, or one room (a plan rectangle on a level). The camera backs off until all of it fits, with a margin.
 */
export type Shot = { turn: number; tilt: number; level?: number; room?: { x: number; y: number; w: number; h: number } };
export const SHOTS = {
  street: { turn: -2.15, tilt: 0.38 },
  back: { turn: 1.0, tilt: 0.4 },
  above: { turn: -2.0, tilt: 0.95 },
  aboveBack: { turn: 1.15, tilt: 0.95 },
} satisfies Record<string, Shot>;

// Shot: the camera stands still, framed on its subject, and once the furniture has had time to load the frame is
// handed back as a picture.
function ShotCam({ layout, shot, onShot }: { layout: Layout; shot: Shot; onShot?: (png: string) => void }) {
  const { camera, gl } = useThree();
  const { width: W, depth: D } = layout.shell;
  useLayoutEffect(() => {
    const floors = layout.floors.length;
    const r = shot.room;
    const y0 = (shot.level ?? 0) * STOREY;
    const box = r
      ? { x0: r.x, x1: r.x + r.w, z0: r.y, z1: r.y + r.h, y0, y1: y0 + WALL_H * 0.7 }
      : { x0: 0, x1: W, z0: 0, z1: D, y0: shot.level === undefined ? 0 : y0, y1: shot.level === undefined ? floors * STOREY : y0 + WALL_H };
    const c = new Vector3((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2);
    const radius = 0.5 * Math.hypot(box.x1 - box.x0, box.y1 - box.y0, box.z1 - box.z0);
    const fov = "fov" in camera ? (camera.fov as number) : 32;
    // a room gets more margin, so it reads as a room in its house rather than a crop
    const dist = (radius / Math.tan(((fov / 2) * Math.PI) / 180)) * (r ? 1.9 : 1.08);
    const dir = new Vector3(Math.cos(shot.tilt) * Math.cos(shot.turn), Math.sin(shot.tilt), Math.cos(shot.tilt) * Math.sin(shot.turn));
    camera.position.copy(c).addScaledVector(dir, dist);
    camera.lookAt(c);
    camera.updateProjectionMatrix();
  }, [camera, layout, W, D, shot]);
  useEffect(() => {
    if (!onShot) return;
    const t = setTimeout(() => onShot(gl.domElement.toDataURL("image/png")), 1800);
    return () => clearTimeout(t);
  }, [gl, onShot]);
  return null;
}

// Showcase: the camera moves on its own, circling the building slowly while drifting in close and back out again,
// like a film of an architect's model. Nobody steers it.
function Tour({ layout, upTo = "all", cutaway = false }: { layout: Layout; upTo?: number | "all"; cutaway?: boolean }) {
  const { camera, size } = useThree();
  const { width: W, depth: D } = layout.shell;
  // The height that shows: cut floors stop at 1.4 m; the whole house has its roof.
  const target = cutaway && upTo !== "all" ? upTo * STOREY + 1.4 : layout.floors.length * STOREY + 1.5;
  // eases to a new floor's height over about a second, so the camera rises with it instead of jumping
  const eased = useRef(target);
  useFrame(({ clock }, dt) => {
    eased.current += (target - eased.current) * Math.min(1, dt * 2.5);
    const h = eased.current;
    const t = clock.elapsedTime;
    const turn = 0.7 + t * 0.11;
    const out = 0.5 + 0.5 * Math.cos(t * 0.32); // a gentle breath in and out, about 20 seconds a cycle
    // Far enough that the whole house (its bounding sphere, with garden room) always fits the narrower view.
    const fov = "fov" in camera ? ((camera as { fov: number }).fov * Math.PI) / 180 : 0.66;
    const narrow = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * (size.width / size.height)));
    // The distance at which the house's bounding sphere just fits, with a margin so nothing ever touches the edge.
    const need = (0.5 * Math.hypot(W, D, h)) / Math.sin(narrow / 2);
    const r = need * (1.02 + 0.08 * out);
    camera.position.set(W / 2 + Math.cos(turn) * r * 0.82, r * 0.55, D / 2 + Math.sin(turn) * r * 0.82);
    camera.lookAt(W / 2, h * 0.45, D / 2);
  });
  return null;
}

function Overview({ layout, autoRotate = false, wheelZoom = true }: { layout: Layout; autoRotate?: boolean; wheelZoom?: boolean }) {
  const { camera } = useThree();
  const [spin, setSpin] = useState(autoRotate);
  const { width: W, depth: D } = layout.shell;
  const h = layout.floors.length * STOREY;
  useLayoutEffect(() => {
    const span = Math.max(W, D);
    // from the street side, so the first view is the front of the house: the door, the path, the garden (a long, narrow
    // building, like a shopfront café, is seen more from the front, so its sign shows)
    camera.position.set(W / 2 + W * 0.9 + 2, h + span * 0.95, D / 2 - D * 0.9 - 4);
    if ("fov" in camera) {
      camera.fov = 45;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(W / 2, h / 3, D / 2);
  }, [camera, W, D, h]);
  return (
    <OrbitControls
      target={[W / 2, h / 3, D / 2]}
      maxPolarAngle={Math.PI / 2.1}
      minDistance={1.5}
      maxDistance={90}
      enableDamping
      enableZoom={wheelZoom}
      autoRotate={spin}
      autoRotateSpeed={0.7}
      onStart={() => setSpin(false)}
      makeDefault
    />
  );
}

// Look around frames the whole building, closer on a wide screen (see fitMargin).
function FitBounds({ children }: { children: ReactNode }) {
  const { size } = useThree();
  return (
    <Bounds fit clip observe margin={fitMargin(size.width / size.height)} maxDuration={0.9}>
      {children}
    </Bounds>
  );
}

// Room names over the floor being looked at; clicking one flies the camera to that room.
// "Whole house": fly back to the starting corner, at a distance that fits the whole building in view.
// Always mounted inside Bounds, whether or not the inside is showing.
function Recenter({ layout, fitKey }: { layout: Layout; fitKey?: number }) {
  const api = useBounds();
  const { camera } = useThree();
  const done = useRef(0);
  useEffect(() => {
    if (!fitKey || fitKey === done.current) return;
    done.current = fitKey;
    const { width: W, depth: D } = layout.shell;
    const h = layout.floors.length * STOREY;
    const span = Math.max(W, D);
    const target: [number, number, number] = [W / 2, h / 3, D / 2];
    const dir = new Vector3(span * 1.05, h + span * 0.95 - h / 3, -span * 1.25).normalize(); // from the street side, as Overview
    const radius = 0.5 * Math.hypot(W, D, h);
    const fov = "fov" in camera ? (camera.fov * Math.PI) / 180 : Math.PI / 4;
    const dist = (radius / Math.sin(fov / 2)) * 1.08;
    api.to({ position: [target[0] + dir.x * dist, target[1] + dir.y * dist, target[2] + dir.z * dist], target });
  }, [fitKey, api, camera, layout]);
  return null;
}

// One overlay for every room's label, each placed every frame where its room's centre lands on screen. (A drei <Html>
// per label made a React root per room, and tearing them all down while leaving the 3D warned in development.)
function RoomLabels({ layout, level }: { layout: Layout; level: number }) {
  const api = useBounds();
  const { camera, size } = useThree();
  const floor = layout.floors.find((f) => f.level === level);
  const y = level * STOREY;
  const spaces = useMemo(() => floor?.spaces.filter((s) => s.zone !== "circulation" || s.kind === "stairs") ?? [], [floor]);
  const tags = useRef<(HTMLButtonElement | null)[]>([]);
  const at = useMemo(() => new Vector3(), []);
  useFrame(() => {
    spaces.forEach((s, i) => {
      const el = tags.current[i];
      if (!el) return;
      at.set(s.rect.x + s.rect.w / 2, y + 1.3, s.rect.y + s.rect.h / 2).project(camera);
      // behind the camera or off the edge: hidden
      const shown = at.z < 1 && Math.abs(at.x) < 1.05 && Math.abs(at.y) < 1.05;
      el.style.visibility = shown ? "visible" : "hidden";
      el.style.transform = `translate(-50%, -50%) translate(${((at.x + 1) / 2) * size.width}px, ${((1 - at.y) / 2) * size.height}px)`;
    });
  });
  if (!floor) return null;
  return (
    // drei moves a fullscreen overlay to wherever this object's origin lands on screen; pin it to the canvas centre
    // instead (and keep that origin mid-house), so each label sits only where its own room projects
    <Html
      fullscreen
      position={[layout.shell.width / 2, y, layout.shell.depth / 2]}
      calculatePosition={(_el, _cam, sz) => [sz.width / 2, sz.height / 2]}
      zIndexRange={[20, 0]}
      style={{ pointerEvents: "none" }}
    >
      {spaces.map((s, i) => (
        <button
          key={s.id}
          ref={(el) => {
            tags.current[i] = el;
          }}
          style={{ position: "absolute", left: 0, top: 0, pointerEvents: "auto", visibility: "hidden" }}
          onClick={() => {
            const box = new Box3(new Vector3(s.rect.x, y, s.rect.y), new Vector3(s.rect.x + s.rect.w, y + WALL_H, s.rect.y + s.rect.h));
            api.refresh(box).fit();
            roomBell();
          }}
          className="whitespace-nowrap rounded-full border border-line bg-paper/90 px-3 py-1 text-xs font-medium text-ink shadow-sm backdrop-blur transition-colors hover:bg-btn hover:text-btn-ink"
        >
          {s.name}
        </button>
      ))}
    </Html>
  );
}

// Walk view: a wide lens like a property tour.
function WideLens() {
  const { camera } = useThree();
  useEffect(() => {
    if ("fov" in camera) {
      camera.fov = 82;
      camera.near = 0.05;
      camera.updateProjectionMatrix();
    }
  }, [camera]);
  return null;
}

// Soft studio light for reflections and fill, built from light panels, so nothing has to download.
function Studio({ night = false }: { night?: boolean }) {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={night ? 0.12 : 0.55}>
      <Lightformer form="rect" intensity={2} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} color="#fff8ee" />
      <Lightformer form="rect" intensity={1.2} position={[-10, 3, 0]} rotation-y={Math.PI / 2} scale={[20, 6, 1]} color="#eaf2ff" />
      <Lightformer form="rect" intensity={1.2} position={[10, 3, 0]} rotation-y={-Math.PI / 2} scale={[20, 6, 1]} color="#fff1df" />
      <Lightformer form="rect" intensity={0.6} position={[0, 3, 10]} rotation-y={Math.PI} scale={[20, 6, 1]} />
    </Environment>
  );
}

export default function HouseScene(props: Props) {
  const colors = useMemo(() => scheme(props.brief?.palette), [props.brief]);
  const look = useMemo(() => lookOf(props.brief, props.taste), [props.brief, props.taste]);
  // On the landing page the house is an architect's white model: smooth walls, no garden.
  const ex = useMemo(() => {
    const e = exteriorOf(props.layout, look, !!props.newBuild);
    // a sketch leaves out the garden: a tree drawn in outline reads as a magnifying glass
    return props.mode === "showcase" ? { ...e, cladding: "render" as const, garden: false } : props.sketch ? { ...e, garden: false } : e;
  }, [props.layout, look, props.newBuild, props.mode, props.sketch]);
  const moods = useMemo(() => moodsFor(props.layout, props.taste?.tags), [props.layout, props.taste]);
  // Sketches and saved pictures are always drawn by day.
  const night = !!props.night && !props.sketch && props.mode !== "shot";
  const { width: W, depth: D } = props.layout.shell;
  const h = props.layout.floors.length * STOREY;
  const orbit = props.mode === "orbit";
  const showcase = props.mode === "showcase";
  const still = props.mode === "shot";
  const top = props.layout.floors.at(-1)?.level ?? 0;
  // The landing page's film starts sharp and steps its resolution down on a slower computer, so it never stutters.
  const [filmDpr, setFilmDpr] = useState(1.75);
  const building = (
    <Building
      layout={props.layout}
      colors={colors}
      look={look}
      ex={ex}
      moods={moods}
      night={night}
      cutaway={(orbit || showcase || still) && props.cutaway}
      upTo={orbit || showcase || still ? props.upTo : "all"}
      extraPlants={props.extraPlants}
      onPick={props.onPick}
      walking={props.mode === "walk" || props.mode === "explore"}
      name={props.name}
    />
  );
  return (
    <Canvas
      shadows
      frameloop={props.paused ? "never" : "always"}
      camera={{ fov: orbit ? 45 : showcase ? 38 : still ? 32 : props.mode === "explore" ? 72 : 82, near: still ? 0.5 : 0.05, far: 300, position: [W * 1.6, h * 2.2 + 6, D * 1.9] }}
      // A picture to save is drawn at twice the screen's resolution, so it stays sharp in the PDF.
      dpr={still ? 2 : showcase ? filmDpr : [1, 2]}
      gl={{ preserveDrawingBuffer: true }}
    >
      {showcase && <PerformanceMonitor bounds={() => [50, 58]} flipflops={3} onChange={({ factor }) => setFilmDpr(Math.round((1 + factor) * 4) / 4)} onFallback={() => setFilmDpr(1)} />}
      {!props.sketch && !showcase && <color attach="background" args={[night ? "#0d1424" : "#dfe8f3"]} />}
      {/* night on the landing page stays readable against the light page: a brighter, bluer moon */}
      <hemisphereLight args={night ? ["#3a4a78", "#141018", showcase ? 0.7 : 0.3] : ["#ffffff", "#d9cfc2", 0.7]} />
      <directionalLight position={[W + 14, 26, -8]} intensity={night ? (showcase ? 1.2 : 0.6) : 2.2} color={night ? "#9fb4ff" : "#ffffff"} castShadow shadow-mapSize={showcase ? [1024, 1024] : [2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
      <ambientLight intensity={night ? 0.06 : 0.25} />
      <Studio night={night} />
      {/* the site sits outside Bounds, so framing fits the building, not the lawn */}
      {!props.sketch && !showcase && (
        <mesh rotation-x={-Math.PI / 2} position={[W / 2, -0.02, D / 2]} receiveShadow>
          <planeGeometry args={[W + 40, D + 40]} />
          <meshStandardMaterial color={night ? mix(colors.ground, "#0d1424", 0.6) : colors.ground} roughness={1} />
        </mesh>
      )}
      <LookCtx.Provider value={look}>
        {orbit ? (
          <FitBounds>
            <Overview layout={props.layout} autoRotate={props.autoRotate} wheelZoom={props.wheelZoom} />
            {building}
            <Recenter layout={props.layout} fitKey={props.fitKey} />
            {props.cutaway && <RoomLabels layout={props.layout} level={props.upTo === "all" || props.upTo === undefined ? top : props.upTo} />}
          </FitBounds>
        ) : showcase ? (
          <>
            {building}
            <Tour layout={props.layout} upTo={props.upTo} cutaway={props.cutaway} />
          </>
        ) : still ? (
          <>
            {building}
            <ShotCam layout={props.layout} shot={props.shot ?? SHOTS.above} onShot={props.onShot} />
          </>
        ) : props.mode === "explore" ? (
          <>
            {building}
            <Explorer layout={props.layout} level={props.level ?? 0} go={props.go} onPose={props.onPose} onRoom={props.onRoom} />
          </>
        ) : (
          <>
            {building}
            <WideLens />
            <Walker {...props} />
          </>
        )}
      </LookCtx.Provider>
      {props.sketch && <SketchMaterial />}
      {props.sketch ? (
        <EffectComposer multisampling={showcase ? 0 : 4}>
          <SketchFx print={props.sketch === "print"} />
        </EffectComposer>
      ) : (
        <EffectComposer multisampling={showcase ? 0 : 4}>
          {showcase ? <></> : <N8AO halfRes aoRadius={0.5} distanceFalloff={0.5} intensity={2.2} quality="medium" />}
          {/* at night, lamps and bulbs glow past their edges */}
          {night && !showcase ? <Bloom mipmapBlur luminanceThreshold={1} intensity={0.9} radius={0.6} /> : <></>}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
