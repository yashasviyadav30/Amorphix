"use client";

import { createContext, useContext, type ReactNode } from "react";
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial, SphereGeometry, type Texture } from "three";
import { art, brick, limewash, rug, tiled, tiles, wallpaper } from "./textures";
import type { Item } from "@/lib/three/furniture";
import { luminance, mix, type Look, type Scheme } from "@/lib/three/materials";
import { WALL_H } from "@/lib/three/geometry";

// Each piece of furniture drawn from simple parts in its own frame: centred on its footprint, standing on
// y = 0, front facing +z, width along x. One shared unit geometry per shape, scaled per part, and one
// material per colour, so a furnished house stays cheap to draw.

const BOX = new BoxGeometry(1, 1, 1);
const SPHERE = new SphereGeometry(0.5, 20, 14);
const cyls = new Map<number, CylinderGeometry>();
const cylGeom = (taper: number) => {
  const k = Math.round(taper * 100) / 100;
  if (!cyls.has(k)) cyls.set(k, new CylinderGeometry(0.5 * k, 0.5, 1, 28));
  return cyls.get(k)!;
};
const mats = new Map<string, MeshStandardMaterial>();
type Finish = { r?: number; m?: number; glow?: number; op?: number };
function mat(color: string, { r = 0.7, m = 0, glow = 0, op = 1 }: Finish = {}) {
  const key = `${color}|${r}|${m}|${glow}|${op}`;
  if (!mats.has(key))
    mats.set(key, new MeshStandardMaterial({ color, roughness: r, metalness: m, emissive: glow ? color : "#000000", emissiveIntensity: glow, transparent: op < 1, opacity: op }));
  return mats.get(key)!;
}

type V3 = [number, number, number];
/** A box by its centre and size. */
function B({ p, s, c, f, rot }: { p: V3; s: V3; c: string; f?: Finish; rot?: V3 }) {
  return <mesh geometry={BOX} material={mat(c, f)} position={p} scale={s} rotation={rot} castShadow receiveShadow />;
}
/** A cylinder standing on its base point; taper < 1 narrows the top. */
function C({ p, r, h, c, f, taper = 1, rot }: { p: V3; r: number; h: number; c: string; f?: Finish; taper?: number; rot?: V3 }) {
  return <mesh geometry={cylGeom(taper)} material={mat(c, f)} position={[p[0], p[1] + h / 2, p[2]]} scale={[r * 2, h, r * 2]} rotation={rot} castShadow receiveShadow />;
}
/** An ellipsoid by its centre and size. */
function S({ p, s, c, f, rot }: { p: V3; s: V3; c: string; f?: Finish; rot?: V3 }) {
  return <mesh geometry={SPHERE} material={mat(c, f)} position={p} scale={s} rotation={rot} castShadow />;
}

/** A box with a canvas texture on its faces. */
function T({ p, s, map, r = 0.85 }: { p: V3; s: V3; map: Texture; r?: number }) {
  return (
    <mesh geometry={BOX} position={p} scale={s} receiveShadow>
      <meshStandardMaterial map={map} roughness={r} />
    </mesh>
  );
}

const WHITE = "#f3f2ef";
const BLACK = "#1c1d20";
const STEEL = "#b7bcc2";
const GLASS: Finish = { r: 0.05, m: 0.1, op: 0.25 };
const LIGHT: Finish = { r: 0.6, glow: 0.9 };
const BOOKS = ["#8c3b2e", "#2f4f6f", "#c9a35a", "#3e5b47", "#d8d2c4", "#5b4a6e", "#b5653a", "#2b2b2b"];
// A fixed pseudo-random sequence, so the same room always gets the same books.
const rand = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const LookCtx = createContext<Look | null>(null);
/** The accent on soft furnishings (a throw, cushions), eased toward the fabric so a deep colour doesn't shout. */
const soft = (k: Scheme) => mix(k.accent, k.textile, 0.35);
const useStyle = () => useContext(LookCtx)?.style ?? "modern";

type LegArgs = [w: number, d: number, h: number, c: string, inset?: number, r?: number];
/** Four legs, shaped by the furniture style the taste profile chose. */
function Legs({ a: [w, d, h, c, inset = 0.05, r = 0.022] }: { a: LegArgs }) {
  const style = useStyle();
  const spots = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const));
  return (
    <>
      {spots.map(([sx, sz]) => {
        const p: V3 = [sx * (w / 2 - inset), 0, sz * (d / 2 - inset)];
        const key = `${sx}${sz}`;
        switch (style) {
          case "midcentury": // splayed, tapered wood
            return <C key={key} p={p} r={r * 1.1} h={h} taper={1.8} c={c} rot={[sz * 0.12, 0, -sx * 0.12]} />;
          case "industrial": // square black steel
            return <B key={key} p={[p[0], h / 2, p[2]]} s={[r * 1.6, h, r * 1.6]} c={BLACK} f={{ r: 0.4, m: 0.7 }} />;
          case "classic": // modern classic: slim, tapered toward the floor
            return <C key={key} p={p} r={r * 0.85} h={h} taper={1.6} c={c} />;
          case "scandi":
            return <C key={key} p={p} r={r * 1.2} h={h} taper={1.15} c={mix(c, "#f1e3c8", 0.45)} />;
          case "boho":
            return <C key={key} p={p} r={r * 1.3} h={h} taper={0.9} c={mix(c, "#c8a06a", 0.5)} f={{ r: 0.95 }} />;
          default: // slim metal
            return <C key={key} p={p} r={r * 0.7} h={h} c={STEEL} f={{ r: 0.3, m: 0.8 }} />;
        }
      })}
    </>
  );
}

function Sofa({ w, d, h, k }: { w: number; d: number; h: number; k: Scheme }) {
  const L = useContext(LookCtx);
  const style = L?.style ?? "modern";
  const lift = { midcentury: 0.18, industrial: 0.12, scandi: 0.14, classic: 0.1, boho: 0.03, modern: 0.06 }[style];
  const arm = style === "midcentury" || style === "scandi" || style === "classic" ? 0.13 : 0.2;
  const seats = w > 1.8 ? 3 : w > 1.1 ? 2 : 1;
  const inner = w - arm * 2;
  const leather = style === "industrial";
  const fabric = leather ? "#7a4a2b" : k.textile;
  const f: Finish = { r: leather ? 0.45 : 0.95 };
  const deep = mix(fabric, "#000000", 0.12);
  const seatY = lift + 0.32;
  return (
    <>
      {lift > 0.04 && <Legs a={[w - 0.1, d - 0.1, lift, k.wood]} />}
      <B p={[0, lift + 0.14, 0]} s={[w, 0.28, d]} c={deep} f={f} />
      <B p={[0, (lift + 0.28 + h) / 2, -d / 2 + 0.11]} s={[w, h - lift - 0.28, 0.22]} c={deep} f={f} />
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B p={[sx * (w / 2 - arm / 2), seatY + 0.06, 0]} s={[arm, 0.3, d]} c={deep} f={f} />
        </group>
      ))}
      {Array.from({ length: seats }, (_, i) => {
        const x = -inner / 2 + inner / seats / 2 + (i * inner) / seats;
        return (
          <group key={i}>
            <B p={[x, seatY + 0.06, 0.08]} s={[inner / seats - 0.02, 0.14, d - 0.3]} c={fabric} f={f} />
            <B p={[x, seatY + 0.27, -d / 2 + 0.3]} s={[inner / seats - 0.03, 0.4, 0.16]} c={fabric} f={f} rot={[-0.15, 0, 0]} />
          </group>
        );
      })}
      {seats > 1 &&
        [-1, 1].map((sx) => <B key={`p${sx}`} p={[sx * (inner / 2 - 0.25), seatY + 0.27, -d / 2 + 0.42]} s={[0.4, 0.36, 0.12]} c={soft(k)} f={{ r: 0.9 }} rot={[-0.2, sx * 0.25, sx * 0.1]} />)}
      {L?.cozy && seats > 1 && (
        <>
          <B p={[w / 2 - arm / 2, seatY + 0.1, 0.05]} s={[arm + 0.04, 0.32, 0.5]} c={mix(k.textile, k.accent, 0.5)} f={{ r: 1 }} />
          <B p={[inner / 2 - 0.3, seatY + 0.28, -d / 2 + 0.45]} s={[0.36, 0.32, 0.1]} c={mix(k.textile, "#ffffff", 0.3)} f={{ r: 0.9 }} rot={[-0.2, -0.3, -0.1]} />
        </>
      )}
      {style === "boho" && <C p={[w / 2 + 0.05, 0, d / 2 + 0.25]} r={0.24} h={0.36} taper={0.9} c={mix(k.accent, "#c8a06a", 0.4)} f={{ r: 1 }} />}
    </>
  );
}

function Lamp({ x = 0, y = 0, z = 0, tall = false, k }: { x?: number; y?: number; z?: number; tall?: boolean; k: Scheme }) {
  const style = useStyle();
  const pole = tall ? 1.3 : 0.28;
  const shade = mix(k.textile, "#fff4e0", 0.6);
  return (
    <group position={[x, y, z]}>
      <C p={[0, 0, 0]} r={tall ? 0.16 : 0.07} h={0.03} c={k.metal} f={{ r: 0.3, m: 0.8 }} />
      <C p={[0, 0.03, 0]} r={0.012} h={pole} c={k.metal} f={{ r: 0.3, m: 0.8 }} />
      {style === "industrial" ? (
        <>
          <C p={[0, pole, 0]} r={tall ? 0.22 : 0.13} h={tall ? 0.18 : 0.12} taper={0.25} c={BLACK} f={{ r: 0.4, m: 0.6 }} />
          <S p={[0, pole + 0.02, 0]} s={[0.08, 0.08, 0.08]} c="#fff1d6" f={LIGHT} />
        </>
      ) : style === "midcentury" ? (
        <S p={[0, pole + 0.1, 0]} s={tall ? [0.42, 0.3, 0.42] : [0.26, 0.2, 0.26]} c={shade} f={LIGHT} />
      ) : (
        <C p={[0, pole, 0]} r={tall ? 0.22 : 0.13} h={tall ? 0.28 : 0.18} taper={style === "classic" ? 0.6 : 0.8} c={shade} f={LIGHT} />
      )}
    </group>
  );
}

function Books({ x0, x1, y, z, depth, seed }: { x0: number; x1: number; y: number; z: number; depth: number; seed: number }) {
  const out: ReactNode[] = [];
  let x = x0;
  for (let i = 0; x < x1; i++) {
    const r = rand(seed + i);
    const t = 0.025 + r * 0.035;
    if (x + t > x1) break;
    const hh = 0.18 + rand(seed + i + 50) * 0.1;
    if (rand(seed + i + 99) > 0.88) {
      x += 0.08; // a gap now and then
      continue;
    }
    out.push(<B key={i} p={[x + t / 2, y + hh / 2, z]} s={[t, hh, depth * (0.75 + r * 0.2)]} c={BOOKS[Math.floor(r * BOOKS.length)]} f={{ r: 0.8 }} />);
    x += t + 0.003;
  }
  return <>{out}</>;
}

function Shelves({ w, d, h, k, c, stock }: { w: number; d: number; h: number; k: Scheme; c: string; stock: "books" | "goods" }) {
  const n = Math.max(3, Math.round(h / 0.4));
  const gap = (h - 0.06) / n;
  return (
    <>
      {[-1, 1].map((sx) => <B key={sx} p={[sx * (w / 2 - 0.015), h / 2, 0]} s={[0.03, h, d]} c={c} />)}
      <B p={[0, h / 2, -d / 2 + 0.01]} s={[w, h, 0.02]} c={mix(c, "#000000", 0.15)} />
      {Array.from({ length: n + 1 }, (_, i) => <B key={`s${i}`} p={[0, 0.03 + i * gap, 0]} s={[w - 0.04, 0.025, d]} c={c} />)}
      {Array.from({ length: n }, (_, i) =>
        stock === "books" ? (
          <Books key={`b${i}`} x0={-w / 2 + 0.05 + (i % 2) * 0.15} x1={w / 2 - 0.08 - ((i + 1) % 2) * 0.2} y={0.045 + i * gap} z={0.01} depth={d * 0.8} seed={i * 17 + Math.round(w * 10)} />
        ) : (
          Array.from({ length: Math.floor((w - 0.1) / 0.28) }, (_, j) => (
            <B key={`g${i}-${j}`} p={[-w / 2 + 0.19 + j * 0.28, 0.045 + i * gap + 0.11, 0]} s={[0.22, 0.2 + rand(i * 7 + j) * 0.08, d * 0.7]} c={BOOKS[Math.floor(rand(i * 13 + j) * BOOKS.length)]} f={{ r: 0.6 }} />
          ))
        ),
      )}
    </>
  );
}

function Chair({ x = 0, z = 0, turn = 0, k }: { x?: number; z?: number; turn?: number; k: Scheme }) {
  return (
    <group position={[x, 0, z]} rotation={[0, turn, 0]}>
      <Legs a={[0.42, 0.42, 0.45, k.wood, 0.03, 0.016]} />
      <B p={[0, 0.47, 0]} s={[0.44, 0.06, 0.44]} c={k.textile} f={{ r: 0.9 }} />
      <B p={[0, 0.76, -0.2]} s={[0.42, 0.44, 0.05]} c={k.textile} f={{ r: 0.9 }} rot={[-0.1, 0, 0]} />
    </group>
  );
}

function OfficeChair({ x = 0, z = 0, turn = 0, k }: { x?: number; z?: number; turn?: number; k: Scheme }) {
  return (
    <group position={[x, 0, z]} rotation={[0, turn, 0]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <B key={i} p={[Math.sin((i * 2 * Math.PI) / 5) * 0.15, 0.04, Math.cos((i * 2 * Math.PI) / 5) * 0.15]} s={[0.04, 0.03, 0.3]} c={BLACK} rot={[0, (i * 2 * Math.PI) / 5, 0]} />
      ))}
      <C p={[0, 0.05, 0]} r={0.025} h={0.38} c={k.metal} f={{ r: 0.3, m: 0.8 }} />
      <B p={[0, 0.47, 0]} s={[0.5, 0.07, 0.48]} c={BLACK} f={{ r: 0.9 }} />
      <B p={[0, 0.82, -0.23]} s={[0.46, 0.55, 0.05]} c={BLACK} f={{ r: 0.9 }} rot={[-0.08, 0, 0]} />
      {[-1, 1].map((sx) => <B key={sx} p={[sx * 0.26, 0.64, -0.02]} s={[0.04, 0.03, 0.28]} c={BLACK} />)}
    </group>
  );
}

function Monitor({ x = 0, y, z = 0, turn = 0 }: { x?: number; y: number; z?: number; turn?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, turn, 0]}>
      <B p={[0, 0.01, 0]} s={[0.22, 0.02, 0.16]} c={BLACK} />
      <B p={[0, 0.14, -0.02]} s={[0.04, 0.24, 0.03]} c={BLACK} />
      <B p={[0, 0.36, 0]} s={[0.6, 0.36, 0.03]} c={BLACK} f={{ r: 0.3 }} />
      <B p={[0, 0.36, 0.016]} s={[0.57, 0.33, 0.002]} c="#2c3e57" f={{ r: 0.2, glow: 0.35 }} />
      <B p={[0, 0.012, 0.3]} s={[0.42, 0.015, 0.13]} c="#d9d9d9" />
    </group>
  );
}

// A house plant in a pot, one of three kinds by its place in the house: a snake plant (upright blades), a fiddle-leaf
// fig (big leaves up a trunk) or a monstera (broad leaves fanning out low), so a house doesn't repeat one plant.
function Plant({ w, h, k, seed = 0 }: { w: number; h: number; k: Scheme; seed?: number }) {
  const pot = Math.min(0.32, w * 0.6);
  const leaf = mix(k.plant, "#3f6e3a", 0.35);
  const dark = mix(leaf, "#000000", 0.28);
  const light = mix(leaf, "#c9d98a", 0.25);
  const kind = seed % 3;
  const top = h - pot;
  return (
    <>
      <C p={[0, 0, 0]} r={pot * 0.46} h={pot} taper={1.22} c={k.pot} f={{ r: 0.75 }} />
      <C p={[0, pot - 0.005, 0]} r={pot * 0.54} h={0.02} c="#3b2c22" />
      {kind === 0 &&
        // snake plant: stiff blades, slightly fanned, two greens
        Array.from({ length: 11 }, (_, i) => {
          const a = i * 2.39;
          const lean = 0.06 + rand(i + 7) * 0.16;
          const bh = top * (0.65 + rand(i) * 0.35);
          return (
            <B key={i} p={[Math.sin(a) * pot * 0.22, pot + bh / 2, Math.cos(a) * pot * 0.22]} s={[0.06, bh, 0.012]} c={i % 2 ? leaf : dark} f={{ r: 0.5 }} rot={[Math.cos(a) * lean, a, -Math.sin(a) * lean]} />
          );
        })}
      {kind === 1 && (
        // fiddle-leaf fig: a slim trunk and broad leaves crowded at the top
        <>
          <C p={[0, pot, 0]} r={0.018} h={top * 0.75} taper={0.8} c="#6b4f3a" />
          {Array.from({ length: 16 }, (_, i) => {
            const a = i * 2.39;
            const up = pot + top * (0.35 + (0.6 * i) / 16);
            const out = 0.08 + rand(i + 2) * w * 0.32;
            return <S key={i} p={[Math.sin(a) * out, up, Math.cos(a) * out]} s={[0.17, 0.02, 0.24]} c={i % 3 ? leaf : light} f={{ r: 0.45 }} rot={[0.5 + rand(i) * 0.4, a, 0]} />;
          })}
        </>
      )}
      {kind === 2 &&
        // monstera: broad split leaves on long stems, spreading wide and low
        Array.from({ length: 9 }, (_, i) => {
          const a = i * 2.39;
          const out = w * (0.25 + rand(i + 4) * 0.25);
          const up = pot + top * (0.3 + rand(i) * 0.6);
          return (
            <group key={i}>
              <C p={[0, pot, 0]} r={0.008} h={up - pot} c={dark} rot={[Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5]} />
              <S p={[Math.sin(a) * out, up, Math.cos(a) * out]} s={[0.34, 0.02, 0.28]} c={i % 2 ? leaf : dark} f={{ r: 0.45 }} rot={[0.35, a, 0]} />
            </group>
          );
        })}
    </>
  );
}

function Bed({ w, d, k }: { w: number; d: number; k: Scheme }) {
  const tables = w >= 2.4;
  const bw = Math.min(1.6, tables ? w - 1.0 : w);
  const back = -d / 2;
  const sheet = mix(WHITE, k.textile, 0.15);
  return (
    <>
      <B p={[0, 0.22, 0.02]} s={[bw + 0.06, 0.24, d - 0.04]} c={k.wood} />
      <B p={[0, 0.46, 0.04]} s={[bw - 0.02, 0.22, d - 0.12]} c={sheet} f={{ r: 0.95 }} />
      <B p={[0, 0.58, 0.28]} s={[bw + 0.04, 0.07, d - 0.55]} c={k.textile} f={{ r: 0.95 }} />
      <B p={[0, 0.6, d / 2 - 0.45]} s={[bw + 0.06, 0.06, 0.55]} c={soft(k)} f={{ r: 0.95 }} />
      <B p={[0, 0.63, -0.08]} s={[bw + 0.04, 0.04, 0.14]} c={sheet} f={{ r: 0.95 }} />
      {[-1, 1].map((sx) => <B key={sx} p={[sx * bw * 0.24, 0.65, back + 0.33]} s={[bw * 0.42, 0.14, 0.38]} c={WHITE} f={{ r: 0.95 }} rot={[-0.25, 0, 0]} />)}
      <B p={[0.15, 0.67, back + 0.5]} s={[0.4, 0.3, 0.1]} c={soft(k)} f={{ r: 0.9 }} rot={[-0.3, 0.1, 0]} />
      <B p={[0, 0.6, back + 0.04]} s={[bw + 0.2, 1.1, 0.08]} c={mix(k.textile, "#000000", 0.2)} f={{ r: 0.95 }} />
      {tables &&
        [-1, 1].map((sx) => {
          const x = sx * (bw / 2 + 0.33);
          return (
            <group key={`t${sx}`}>
              <B p={[x, 0.25, back + 0.27]} s={[0.45, 0.5, 0.42]} c={k.wood} />
              <B p={[x, 0.33, back + 0.485]} s={[0.36, 0.005, 0.005]} c={BLACK} />
              <Lamp x={x} y={0.5} z={back + 0.22} k={k} />
            </group>
          );
        })}
    </>
  );
}

function KitchenRun({ w, d, k }: { w: number; d: number; k: Scheme }) {
  const fridge = w >= 2.4 ? 0.8 : 0;
  const run = w - fridge;
  const x0 = -w / 2;
  const front = d / 2;
  const doors = mix(k.base, k.wood, 0.15);
  const top = luminance(k.base) > 0.55 ? "#3b3c3f" : "#eceae5";
  const units = Math.max(1, Math.round(run / 0.6));
  const hob = x0 + Math.min(0.9, run * 0.25);
  const sink = x0 + run * 0.6;
  return (
    <>
      <B p={[x0 + run / 2, 0.06, front - 0.08]} s={[run, 0.12, 0.02]} c={BLACK} />
      <B p={[x0 + run / 2, 0.47, 0]} s={[run, 0.78, d - 0.04]} c={doors} />
      {Array.from({ length: units - 1 }, (_, i) => (
        <B key={`seam${i}`} p={[x0 + ((i + 1) * run) / units, 0.47, front - 0.015]} s={[0.006, 0.76, 0.01]} c={mix(doors, "#000000", 0.3)} />
      ))}
      {Array.from({ length: units }, (_, i) => (
        <B key={`h${i}`} p={[x0 + ((i + 0.5) * run) / units, 0.8, front]} s={[0.22, 0.015, 0.02]} c={k.metal} f={{ r: 0.3, m: 0.8 }} />
      ))}
      <B p={[x0 + run / 2, 0.88, 0.01]} s={[run, 0.04, d]} c={top} f={{ r: 0.35 }} />
      {/* hob, pot and pan */}
      <B p={[hob, 0.902, 0.02]} s={[0.58, 0.006, 0.5]} c={BLACK} f={{ r: 0.15 }} />
      <C p={[hob - 0.13, 0.905, -0.08]} r={0.12} h={0.14} c={STEEL} f={{ r: 0.25, m: 0.9 }} />
      <C p={[hob + 0.14, 0.905, 0.1]} r={0.13} h={0.04} c={BLACK} f={{ r: 0.4 }} />
      <B p={[hob + 0.36, 0.93, 0.18]} s={[0.22, 0.02, 0.03]} c={BLACK} rot={[0, 0.5, 0]} />
      {/* hood */}
      <B p={[hob, 1.72, -d / 2 + 0.25]} s={[0.62, 0.12, 0.48]} c={STEEL} f={{ r: 0.3, m: 0.8 }} />
      <B p={[hob, 2.0, -d / 2 + 0.15]} s={[0.26, 0.45, 0.26]} c={STEEL} f={{ r: 0.3, m: 0.8 }} />
      {/* sink, tap and dish rack */}
      <B p={[sink, 0.895, 0.02]} s={[0.6, 0.012, 0.42]} c={STEEL} f={{ r: 0.2, m: 0.9 }} />
      <C p={[sink, 0.9, -d / 2 + 0.1]} r={0.018} h={0.3} c={STEEL} f={{ r: 0.2, m: 0.9 }} />
      <B p={[sink, 1.19, -d / 2 + 0.18]} s={[0.03, 0.03, 0.18]} c={STEEL} f={{ r: 0.2, m: 0.9 }} />
      {[0, 1, 2].map((i) => (
        <C key={`pl${i}`} p={[sink + 0.48, 0.92, -0.12 + i * 0.05]} r={0.12} h={0.012} c={WHITE} f={{ r: 0.3 }} rot={[Math.PI / 2.4, 0, 0]} />
      ))}
      {/* kettle, board, jars, herbs */}
      <C p={[sink - 0.55, 0.9, -0.1]} r={0.08} h={0.2} taper={0.7} c={k.metal} f={{ r: 0.3, m: 0.7 }} />
      <B p={[x0 + run * 0.82, 0.91, 0.05]} s={[0.4, 0.02, 0.28]} c={mix(k.wood, "#ffffff", 0.2)} f={{ r: 0.8 }} />
      {[0, 1, 2].map((i) => (
        <C key={`j${i}`} p={[x0 + 0.12 + i * 0.12, 0.9, -d / 2 + 0.12]} r={0.045} h={0.16 + i * 0.03} c={i === 1 ? k.pot : WHITE} f={{ r: 0.4 }} />
      ))}
      <C p={[x0 + run * 0.92, 0.9, -d / 2 + 0.14]} r={0.07} h={0.11} c={k.pot} />
      <S p={[x0 + run * 0.92, 1.08, -d / 2 + 0.14]} s={[0.2, 0.16, 0.2]} c={k.plant} f={{ r: 0.7 }} />
      {/* wall cabinets at the ends, leaving the middle (and any window) open */}
      {[x0 + 0.3, x0 + run - 0.45].map((x, i) => (
        <group key={`u${i}`}>
          <B p={[x, 1.85, -d / 2 + 0.18]} s={[i ? 0.9 : 0.6, 0.72, 0.35]} c={doors} />
          <B p={[x, 1.55, -d / 2 + 0.36]} s={[0.2, 0.015, 0.02]} c={k.metal} f={{ r: 0.3, m: 0.8 }} />
        </group>
      ))}
      {fridge > 0 && (
        <group position={[w / 2 - fridge / 2, 0, 0]}>
          <B p={[0, 1.0, 0]} s={[fridge - 0.04, 2.0, d - 0.02]} c={STEEL} f={{ r: 0.25, m: 0.75 }} />
          <B p={[0, 1.32, front]} s={[fridge - 0.06, 0.006, 0.012]} c={BLACK} />
          {[-1, 1].map((sx) => <B key={sx} p={[sx * 0.05, 0.95, front + 0.02]} s={[0.02, 0.5, 0.03]} c={BLACK} />)}
        </group>
      )}
    </>
  );
}

function Island({ w, d, k }: { w: number; d: number; k: Scheme }) {
  const body = Math.min(0.9, d - 0.45);
  const z0 = -d / 2 + body / 2;
  const stools = Math.max(1, Math.floor(w / 0.6));
  const top = luminance(k.base) > 0.55 ? "#3b3c3f" : "#eceae5";
  return (
    <>
      <B p={[0, 0.45, z0]} s={[w - 0.1, 0.9, body]} c={k.wood} />
      <B p={[0, 0.92, z0 + 0.12]} s={[w, 0.05, body + 0.25]} c={top} f={{ r: 0.35 }} />
      {Array.from({ length: stools }, (_, i) => {
        const x = -w / 2 + w / stools / 2 + (i * w) / stools;
        return (
          <group key={i} position={[x, 0, d / 2 - 0.22]}>
            <C p={[0, 0, 0]} r={0.16} h={0.02} c={k.metal} f={{ r: 0.3, m: 0.8 }} />
            <C p={[0, 0.02, 0]} r={0.02} h={0.6} c={k.metal} f={{ r: 0.3, m: 0.8 }} />
            <C p={[0, 0.62, 0]} r={0.19} h={0.06} c={k.textile} f={{ r: 0.9 }} />
          </group>
        );
      })}
      <C p={[-w * 0.15, 0.945, z0]} r={0.16} h={0.08} taper={1.4} c={WHITE} f={{ r: 0.3 }} />
      {[0, 1, 2].map((i) => <S key={i} p={[-w * 0.15 + (i - 1) * 0.06, 1.03, z0 + (i % 2) * 0.04]} s={[0.08, 0.08, 0.08]} c={["#d9a33a", "#b8402f", "#88a63c"][i]} f={{ r: 0.5 }} />)}
      <C p={[w * 0.25, 0.945, z0]} r={0.05} h={0.22} c={k.pot} f={{ r: 0.4 }} />
    </>
  );
}

function DiningSet({ w, d, k }: { w: number; d: number; k: Scheme }) {
  const tl = Math.min(1.8, w - 0.3);
  const tw = Math.min(0.95, d - 0.9);
  const per = tl >= 1.5 ? 2 : 1;
  const xs = per === 2 ? [-tl / 4, tl / 4] : [0];
  return (
    <>
      <Legs a={[tl, tw, 0.73, k.wood, 0.08, 0.03]} />
      <B p={[0, 0.75, 0]} s={[tl, 0.04, tw]} c={k.wood} f={{ r: 0.5 }} />
      {xs.flatMap((x) => [
        <Chair key={`a${x}`} x={x} z={-tw / 2 - 0.22} k={k} />,
        <Chair key={`b${x}`} x={x} z={tw / 2 + 0.22} turn={Math.PI} k={k} />,
        <C key={`pa${x}`} p={[x, 0.77, -tw / 2 + 0.17]} r={0.13} h={0.012} c={WHITE} f={{ r: 0.3 }} />,
        <C key={`pb${x}`} p={[x, 0.77, tw / 2 - 0.17]} r={0.13} h={0.012} c={WHITE} f={{ r: 0.3 }} />,
      ])}
      <C p={[0, 0.77, 0]} r={0.06} h={0.2} taper={0.6} c={k.pot} f={{ r: 0.4 }} />
      {[0, 1, 2, 3].map((i) => <S key={i} p={[Math.sin(i * 1.6) * 0.06, 1.03 + (i % 2) * 0.05, Math.cos(i * 1.6) * 0.06]} s={[0.09, 0.09, 0.09]} c={i % 2 ? k.accent : WHITE} f={{ r: 0.8 }} />)}
      {/* pendant over the table, hung from the ceiling */}
      <C p={[0, 1.75, 0]} r={0.005} h={WALL_H - 1.75} c={BLACK} />
      <C p={[0, 1.6, 0]} r={0.22} h={0.18} taper={0.25} c={k.metal} f={{ r: 0.35, m: 0.7 }} />
      <S p={[0, 1.6, 0]} s={[0.1, 0.1, 0.1]} c="#fff1d6" f={LIGHT} />
    </>
  );
}

function Cabinet({ w, d, h, c, k }: { w: number; d: number; h: number; c: string; k: Scheme }) {
  const doors = Math.max(1, Math.round(w / 0.5));
  return (
    <>
      <B p={[0, h / 2 + 0.04, 0]} s={[w, h - 0.08, d]} c={c} />
      <Legs a={[w - 0.04, d - 0.04, 0.08, BLACK, 0.04, 0.015]} />
      {Array.from({ length: doors - 1 }, (_, i) => (
        <B key={i} p={[-w / 2 + ((i + 1) * w) / doors, h / 2 + 0.04, d / 2]} s={[0.006, h - 0.12, 0.01]} c={mix(c, "#000000", 0.35)} />
      ))}
      {Array.from({ length: doors }, (_, i) => (
        <B key={`k${i}`} p={[-w / 2 + ((i + 0.5) * w) / doors + (i % 2 ? -0.17 : 0.17) * (doors > 1 ? 1 : 0), h * 0.6, d / 2 + 0.012]} s={[0.012, 0.14, 0.012]} c={k.metal} f={{ r: 0.3, m: 0.8 }} />
      ))}
    </>
  );
}

function Toilet() {
  return (
    <>
      <B p={[0, 0.2, -0.05]} s={[0.3, 0.4, 0.4]} c={WHITE} f={{ r: 0.2 }} />
      <C p={[0, 0.3, 0.06]} r={0.19} h={0.12} c={WHITE} f={{ r: 0.2 }} />
      <C p={[0, 0.42, 0.06]} r={0.195} h={0.02} c={WHITE} f={{ r: 0.3 }} />
      <B p={[0, 0.62, -0.26]} s={[0.4, 0.38, 0.16]} c={WHITE} f={{ r: 0.2 }} />
    </>
  );
}

function Washer({ k }: { k: Scheme }) {
  return (
    <>
      <B p={[0, 0.43, 0]} s={[0.6, 0.86, 0.6]} c={WHITE} f={{ r: 0.35 }} />
      <C p={[0, 0.42, 0.29]} r={0.2} h={0.03} c="#6b7280" f={{ r: 0.2, m: 0.5 }} rot={[Math.PI / 2, 0, 0]} />
      <C p={[0, 0.42, 0.3]} r={0.15} h={0.02} c="#25303d" f={GLASS} rot={[Math.PI / 2, 0, 0]} />
      <B p={[0, 0.8, 0.301]} s={[0.56, 0.08, 0.004]} c={k.metal} />
    </>
  );
}

const FALLBACK_LOOK = { tile: "#e9e7e2", tileKind: "plain", curtain: "#ece6dc", frame: "#232323", art: ["#3a6ea5", "#4f7a4a", "#c9b8a3"], feature: "#d8d2c6", finish: "paint", style: "modern" } as const;

function Rug({ w, d, k }: { w: number; d: number; k: Scheme }) {
  const style = useStyle();
  const ground = mix(k.accent, k.textile, 0.55);
  if (style === "boho") return <T p={[0, 0.007, 0]} s={[w, 0.014, d]} map={rug(ground, mix(k.accent, "#000000", 0.15), "kilim")} r={1} />;
  const light = style === "scandi";
  return (
    <>
      <B p={[0, 0.006, 0]} s={[w, 0.012, d]} c={light ? mix(k.textile, "#ffffff", 0.6) : mix(k.accent, "#ffffff", 0.15)} f={{ r: 1 }} />
      <B p={[0, 0.011, 0]} s={[w - 0.25, 0.012, d - 0.25]} c={light ? mix(k.textile, "#ffffff", 0.75) : ground} f={{ r: 1 }} />
    </>
  );
}

// Each room's feature wall in its own shade of the brief's colour: the living room takes it as it is, a bedroom a
// softer one, the dining room a warmer one (toward the wood), a study a deeper one.
const SHADE: Record<string, (c: string, k: Scheme) => string> = {
  bedroom: (c, k) => mix(c, k.textile, 0.45),
  "guest-room": (c) => mix(c, "#ffffff", 0.4),
  dining: (c, k) => mix(c, k.wood, 0.35),
  office: (c) => mix(c, "#2c3e4a", 0.3),
};

function FeatureWall({ w, d, h, kind, k }: { w: number; d: number; h: number; kind?: string; k: Scheme }) {
  const l = useContext(LookCtx) ?? FALLBACK_LOOK;
  const c = l.finish === "paint" || l.finish === "plaster" || l.finish === "wallpaper" ? (SHADE[kind ?? ""]?.(l.feature, k) ?? l.feature) : l.feature;
  switch (l.finish) {
    case "panel": {
      const n = Math.max(1, Math.floor(w / 0.1));
      return (
        <>
          <B p={[0, h / 2, -d / 4]} s={[w, h, d / 2]} c={mix(c, "#000000", 0.35)} />
          {Array.from({ length: n }, (_, i) => <B key={i} p={[-w / 2 + (i + 0.5) * (w / n), h / 2, d / 4]} s={[(w / n) * 0.62, h, d / 2]} c={c} f={{ r: 0.6 }} />)}
        </>
      );
    }
    case "brick":
      return <T p={[0, h / 2, 0]} s={[w, h, d]} map={tiled(brick(c), w, h, 0.6)} r={0.95} />;
    case "wallpaper":
      return <T p={[0, h / 2, 0]} s={[w, h, d]} map={tiled(wallpaper(mix(c, "#ffffff", 0.55), c), w, h, 0.8)} />;
    case "plaster":
      return <T p={[0, h / 2, 0]} s={[w, h, d]} map={tiled(limewash(c), w, h, 1.6)} r={0.95} />;
    default:
      return <B p={[0, h / 2, 0]} s={[w, h, d]} c={c} f={{ r: 0.9 }} />;
  }
}

// Which prints a style leans to (see textures.art): each frame in the house takes one by its place, so frames
// side by side differ.
const ART_KINDS = { midcentury: [2, 7, 3, 4], boho: [0, 5, 6, 2], scandi: [1, 4, 5, 3], classic: [1, 6, 3, 5], industrial: [3, 7, 4, 2], modern: [3, 4, 7, 0] } as const;

function Art({ w, d, h, seed }: { w: number; d: number; h: number; seed: number }) {
  const l = useContext(LookCtx) ?? FALLBACK_LOOK;
  const kinds = ART_KINDS[l.style];
  const kind = kinds[Math.floor(rand(seed) * kinds.length)];
  return (
    <>
      <B p={[0, h / 2, 0]} s={[w, h, d]} c={l.frame} f={{ r: 0.5 }} />
      <B p={[0, h / 2, d / 2 + 0.001]} s={[w - 0.05, h - 0.05, 0.002]} c={WHITE} f={{ r: 0.9 }} />
      <T p={[0, h / 2, d / 2 + 0.003]} s={[w * 0.72, h * 0.72, 0.002]} map={art([...l.art], kind, seed)} r={0.8} />
    </>
  );
}

/** One piece, placed and turned in the world. */
export function Model({ it, k: palette }: { it: Item; k: Scheme }) {
  const L = useContext(LookCtx);
  // a very dark palette wood (walnut, mahogany) is lifted a little toward oak, so a room doesn't go heavy and brown
  const k = luminance(palette.wood) < 0.3 ? { ...palette, wood: mix(palette.wood, "#b08a62", 0.35) } : palette;
  const { lw: w, ld: d, h } = it;
  let body: ReactNode;
  switch (it.name) {
    case "sofa":
      body = <Sofa w={w} d={d} h={h} k={k} />;
      break;
    case "armchair":
      body = <Sofa w={w} d={d} h={h} k={{ ...k, textile: k.accent, accent: k.textile }} />;
      break;
    case "rug":
      body = <Rug w={w} d={d} k={k} />;
      break;
    case "coffee table":
      body = (
        <>
          <Legs a={[w, d, h - 0.04, k.wood, 0.06, 0.02]} />
          <B p={[0, h - 0.02, 0]} s={[w, 0.04, d]} c={k.wood} f={{ r: 0.45 }} />
          <B p={[0, 0.12, 0]} s={[w - 0.12, 0.02, d - 0.12]} c={k.wood} />
          <B p={[-w * 0.2, h + 0.02, 0.02]} s={[0.28, 0.035, 0.2]} c={BOOKS[1]} f={{ r: 0.8 }} />
          <B p={[-w * 0.2, h + 0.05, 0.02]} s={[0.24, 0.03, 0.17]} c={BOOKS[4]} f={{ r: 0.8 }} rot={[0, 0.2, 0]} />
          <C p={[w * 0.22, h, -0.05]} r={0.06} h={0.18} taper={0.7} c={k.pot} f={{ r: 0.4 }} />
          <S p={[w * 0.22, h + 0.24, -0.05]} s={[0.14, 0.12, 0.14]} c={k.plant} f={{ r: 0.7 }} />
        </>
      );
      break;
    case "media unit": {
      const tv = Math.min(1.45, w * 0.8);
      body = (
        <>
          <Cabinet w={w} d={d} h={0.5} c={k.wood} k={k} />
          <B p={[0, 0.53, -0.02]} s={[0.3, 0.02, 0.2]} c={BLACK} />
          <B p={[0, 0.6, -0.04]} s={[0.05, 0.12, 0.04]} c={BLACK} />
          <B p={[0, 0.66 + tv * 0.28, -0.05]} s={[tv, tv * 0.56, 0.04]} c={BLACK} f={{ r: 0.25 }} />
          <B p={[0, 0.66 + tv * 0.28, -0.028]} s={[tv - 0.03, tv * 0.56 - 0.03, 0.002]} c="#1f2a38" f={{ r: 0.1, glow: 0.25 }} />
          <B p={[0, 0.555, 0.1]} s={[Math.min(0.9, tv * 0.6), 0.06, 0.08]} c={BLACK} />
          <C p={[w / 2 - 0.15, 0.5, 0]} r={0.06} h={0.25} taper={0.6} c={k.pot} f={{ r: 0.4 }} />
        </>
      );
      break;
    }
    case "floor lamp":
      body = <Lamp tall k={k} />;
      break;
    case "bookshelf":
      body = <Shelves w={w} d={d} h={h} k={k} c={k.wood} stock="books" />;
      break;
    case "shelving":
      body = <Shelves w={w} d={d} h={h} k={k} c={it.role === "metal" ? k.metal : k.wood} stock="goods" />;
      break;
    case "bed":
      body = <Bed w={w} d={d} k={k} />;
      break;
    case "wardrobe":
      body = <Cabinet w={w} d={d} h={h} c={k.wood} k={k} />;
      break;
    case "sideboard":
      body = (
        <>
          <Cabinet w={w} d={d} h={h} c={k.wood} k={k} />
          <Lamp x={-w / 2 + 0.2} y={h} k={k} />
          <C p={[w * 0.2, h, 0]} r={0.07} h={0.3} taper={0.6} c={k.pot} f={{ r: 0.4 }} />
          <B p={[w * 0.38, h + 0.03, 0]} s={[0.25, 0.06, 0.18]} c={BOOKS[0]} f={{ r: 0.8 }} />
        </>
      );
      break;
    case "desk":
      body = (
        <>
          {[-1, 1].map((sx) => <B key={sx} p={[sx * (w / 2 - 0.02), h / 2, 0]} s={[0.04, h, d]} c={k.wood} />)}
          <B p={[0, h - 0.02, 0]} s={[w, 0.04, d]} c={k.wood} f={{ r: 0.45 }} />
          <Monitor y={h} z={-d / 2 + 0.15} />
          <C p={[w / 2 - 0.2, h, 0.05]} r={0.04} h={0.1} c={WHITE} f={{ r: 0.3 }} />
          <Lamp x={-w / 2 + 0.18} y={h} z={-d / 2 + 0.15} k={k} />
        </>
      );
      break;
    case "office chair":
      body = <OfficeChair k={k} />;
      break;
    case "desk row": {
      const seats = Math.max(1, Math.floor(w / 0.9));
      const xs = Array.from({ length: seats }, (_, i) => -w / 2 + w / seats / 2 + (i * w) / seats);
      body = (
        <>
          {[-1, 1].map((sx) => <B key={sx} p={[sx * (w / 2 - 0.02), 0.37, 0]} s={[0.04, 0.74, 0.7]} c={k.metal} />)}
          <B p={[0, 0.74, 0]} s={[w, 0.03, 0.75]} c={k.wood} f={{ r: 0.45 }} />
          <B p={[0, 0.95, 0]} s={[w, 0.4, 0.02]} c={k.textile} f={{ r: 0.95 }} />
          {xs.flatMap((x) => [
            <Monitor key={`a${x}`} x={x} y={0.755} z={-0.22} turn={Math.PI} />,
            <Monitor key={`b${x}`} x={x} y={0.755} z={0.22} />,
            <OfficeChair key={`c${x}`} x={x} z={-d / 2 + 0.25} k={k} />,
            <OfficeChair key={`d${x}`} x={x} z={d / 2 - 0.25} turn={Math.PI} k={k} />,
          ])}
        </>
      );
      break;
    }
    case "meeting set": {
      const tl = w - 0.9;
      const per = Math.max(1, Math.floor(tl / 0.8));
      const xs = Array.from({ length: per }, (_, i) => -tl / 2 + tl / per / 2 + (i * tl) / per);
      body = (
        <>
          <C p={[-tl / 3, 0, 0]} r={0.2} h={0.72} taper={0.4} c={k.metal} />
          <C p={[tl / 3, 0, 0]} r={0.2} h={0.72} taper={0.4} c={k.metal} />
          <B p={[0, 0.74, 0]} s={[tl, 0.04, 1.1]} c={k.wood} f={{ r: 0.4 }} />
          {xs.flatMap((x) => [
            <OfficeChair key={`a${x}`} x={x} z={-0.8} k={k} />,
            <OfficeChair key={`b${x}`} x={x} z={0.8} turn={Math.PI} k={k} />,
          ])}
          <B p={[xs[0], 0.77, -0.3]} s={[0.32, 0.015, 0.22]} c="#9aa0a6" f={{ r: 0.3, m: 0.6 }} />
          <C p={[0, 0.76, 0]} r={0.08} h={0.12} c={k.pot} />
          <S p={[0, 0.95, 0]} s={[0.22, 0.16, 0.22]} c={k.plant} f={{ r: 0.7 }} />
        </>
      );
      break;
    }
    case "wall screen":
    case "mirror":
      body = (
        <>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={it.name === "mirror" ? k.metal : BLACK} f={{ r: 0.3, m: 0.6 }} />
          <B p={[0, h / 2, d / 2]} s={[w - 0.05, h - 0.05, 0.004]} c={it.name === "mirror" ? "#c9d6df" : "#1f2a38"} f={{ r: 0.05, m: 0.9, glow: it.name === "mirror" ? 0 : 0.25 }} />
        </>
      );
      break;
    case "reception desk":
      body = (
        <>
          <B p={[0, h / 2, d / 2 - 0.05]} s={[w, h, 0.1]} c={k.wood} f={{ r: 0.5 }} />
          <B p={[0, h + 0.015, d / 2 - 0.12]} s={[w + 0.04, 0.03, 0.28]} c={k.base} f={{ r: 0.35 }} />
          <B p={[0, 0.74, -0.05]} s={[w - 0.1, 0.03, d - 0.2]} c={k.base} />
          <B p={[0, h * 0.55, d / 2 + 0.002]} s={[w * 0.4, 0.06, 0.004]} c={k.accent} f={{ glow: 0.3 }} />
          <Monitor y={0.755} z={-0.05} turn={Math.PI} />
          <Plant w={0.35} h={0.6} k={k} />
        </>
      );
      break;
    case "service counter":
      body = (
        <>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={k.wood} f={{ r: 0.5 }} />
          <B p={[0, h + 0.02, 0]} s={[w + 0.04, 0.04, d + 0.04]} c={k.base} f={{ r: 0.35 }} />
          <B p={[w * 0.25, h + 0.22, 0.05]} s={[w * 0.4, 0.4, d * 0.7]} c="#e8f1f6" f={GLASS} />
          {[0, 1, 2, 3].map((i) => <S key={i} p={[w * 0.12 + i * 0.12, h + 0.09, 0.05]} s={[0.1, 0.07, 0.1]} c={["#c58b4a", "#8a5a33", "#e2c38f", "#b2472f"][i]} f={{ r: 0.7 }} />)}
          <B p={[-w * 0.3, h + 0.22, -0.05]} s={[0.45, 0.4, 0.4]} c={STEEL} f={{ r: 0.25, m: 0.8 }} />
          <B p={[-w * 0.3, h + 0.12, 0.12]} s={[0.35, 0.03, 0.12]} c={BLACK} />
          {[0, 1, 2].map((i) => <C key={`c${i}`} p={[-w * 0.08 + i * 0.1, h + 0.04, 0.15]} r={0.04} h={0.09} c={WHITE} f={{ r: 0.3 }} />)}
        </>
      );
      break;
    case "cafe table":
      body = (
        <>
          <C p={[0, 0, 0]} r={0.22} h={0.03} c={BLACK} />
          <C p={[0, 0.03, 0]} r={0.03} h={0.7} c={BLACK} />
          <C p={[0, 0.73, 0]} r={Math.min(0.4, w * 0.3)} h={0.03} c={k.wood} f={{ r: 0.45 }} />
          <Chair x={-w / 2 + 0.24} turn={Math.PI / 2} k={k} />
          <Chair x={w / 2 - 0.24} turn={-Math.PI / 2} k={k} />
          <C p={[0.08, 0.76, 0]} r={0.045} h={0.09} c={WHITE} f={{ r: 0.3 }} />
          <C p={[-0.1, 0.76, 0.05]} r={0.05} h={0.14} taper={0.6} c={k.pot} />
        </>
      );
      break;
    case "display table":
      body = (
        <>
          <Legs a={[w, d, h - 0.04, k.metal, 0.05, 0.02]} />
          <B p={[0, h - 0.02, 0]} s={[w, 0.04, d]} c={k.wood} f={{ r: 0.45 }} />
          {[0, 1, 2, 3].map((i) => (
            <B key={i} p={[-w / 2 + 0.25 + i * ((w - 0.5) / 3), h + 0.06 + (i % 2) * 0.03, 0]} s={[0.32, 0.12 + (i % 2) * 0.06, 0.26]} c={BOOKS[(i * 3) % BOOKS.length]} f={{ r: 0.85 }} />
          ))}
        </>
      );
      break;
    case "vanity":
      body = (
        <>
          <B p={[0, 0.48, 0]} s={[w, 0.6, d]} c={k.wood} />
          <B p={[0, 0.8, 0]} s={[w + 0.02, 0.04, d + 0.02]} c={WHITE} f={{ r: 0.25 }} />
          <C p={[0, 0.82, 0.03]} r={0.2} h={0.12} taper={1.3} c={WHITE} f={{ r: 0.15 }} />
          <C p={[0, 0.82, -d / 2 + 0.06]} r={0.015} h={0.22} c={STEEL} f={{ r: 0.2, m: 0.9 }} />
          <B p={[0, 1.04, -d / 2 + 0.12]} s={[0.025, 0.025, 0.14]} c={STEEL} f={{ r: 0.2, m: 0.9 }} />
          <B p={[0, 1.45, -d / 2 + 0.01]} s={[w * 0.85, 0.75, 0.02]} c="#c9d6df" f={{ r: 0.05, m: 0.9 }} />
          <B p={[0, 1.88, -d / 2 + 0.06]} s={[w * 0.6, 0.04, 0.06]} c="#fff4e0" f={LIGHT} />
          <C p={[w / 2 - 0.12, 0.82, 0]} r={0.035} h={0.1} c={k.pot} />
          <B p={[w / 2 + 0.02, 0.55, 0.1]} s={[0.04, 0.5, 0.25]} c={k.accent} f={{ r: 1 }} />
        </>
      );
      break;
    case "shower":
      body = (
        <>
          <B p={[0, 0.03, 0]} s={[w, 0.06, d]} c={WHITE} f={{ r: 0.3 }} />
          <B p={[0, 1.05, d / 2 - 0.02]} s={[w, 2.0, 0.015]} c="#dbe8ef" f={GLASS} />
          <C p={[0, 0.06, -d / 2 + 0.04]} r={0.012} h={1.95} c={STEEL} f={{ r: 0.2, m: 0.9 }} />
          <C p={[0, 2.0, -d / 2 + 0.2]} r={0.12} h={0.02} c={STEEL} f={{ r: 0.2, m: 0.9 }} />
          <B p={[0, 2.0, -d / 2 + 0.1]} s={[0.02, 0.02, 0.2]} c={STEEL} f={{ r: 0.2, m: 0.9 }} />
        </>
      );
      break;
    case "toilet":
      body = <Toilet />;
      break;
    case "washer":
      body = <Washer k={k} />;
      break;
    case "island":
      body = <Island w={w} d={d} k={k} />;
      break;
    case "kitchen run":
      body = <KitchenRun w={w} d={d} k={k} />;
      break;
    case "dining set":
      body = <DiningSet w={w} d={d} k={k} />;
      break;
    case "plant":
      body = <Plant w={w} h={h} k={k} seed={Math.round(Math.abs(it.x * 3 + it.z * 5))} />;
      break;
    case "wall plant":
      body = (
        <>
          <B p={[0, -0.02, 0]} s={[w + 0.1, 0.03, d]} c={k.wood} f={{ r: 0.5 }} />
          <Plant w={w} h={h} k={k} seed={Math.round(Math.abs(it.x * 3 + it.z * 5))} />
        </>
      );
      break;
    case "feature wall":
      body = <FeatureWall w={w} d={d} h={h} kind={it.kind} k={k} />;
      break;
    case "wainscot": {
      // panelling below a rail, for a classic room only: a pale board, a cap rail and stiles every 60 cm or so
      if ((L ?? FALLBACK_LOOK).style !== "classic") return null;
      const board = mix(k.wall, k.wood, 0.1);
      const line = mix(board, "#000000", 0.16);
      const n = Math.max(1, Math.round(w / 0.6));
      body = (
        <>
          <B p={[0, h / 2, 0]} s={[w, h, d]} c={board} f={{ r: 0.6 }} />
          <B p={[0, h - 0.02, 0.012]} s={[w, 0.05, d + 0.025]} c={board} f={{ r: 0.5 }} />
          {Array.from({ length: n + 1 }, (_, i) => (
            <B key={i} p={[-w / 2 + (i * w) / n, h / 2 - 0.02, 0.003]} s={[0.06, h - 0.16, d + 0.004]} c={line} f={{ r: 0.6 }} />
          ))}
          <B p={[0, 0.24, 0.003]} s={[w, 0.04, d + 0.004]} c={line} f={{ r: 0.6 }} />
        </>
      );
      break;
    }
    case "art":
      body = <Art w={w} d={d} h={h} seed={Math.round(Math.abs(it.x * 7 + it.z * 13))} />;
      break;
    case "backsplash":
    case "tile": {
      const l = L ?? FALLBACK_LOOK;
      body = <T p={[0, h / 2, 0]} s={[w, h, d]} map={tiled(tiles(l.tile, l.tileKind), w, h, it.name === "tile" ? 0.6 : 0.4)} r={0.3} />;
      break;
    }
    case "curtain": {
      const folds = 5;
      body = (
        <>
          {Array.from({ length: folds }, (_, i) => (
            <C key={i} p={[-w / 2 + w / folds / 2 + (i * w) / folds, 0, (i % 2) * 0.02]} r={w / folds / 1.6} h={h} c={(L ?? FALLBACK_LOOK).curtain} f={{ r: 1 }} />
          ))}
        </>
      );
      break;
    }
    case "curtain rod":
      body = <C p={[0, h / 2 - w / 2, 0]} r={0.012} h={w} c={k.metal} f={{ r: 0.3, m: 0.8 }} rot={[0, 0, Math.PI / 2]} />;
      break;
    default:
      body = <B p={[0, h / 2, 0]} s={[w, h, d]} c={k[it.role]} />;
  }
  return (
    <group position={[it.x, it.y, it.z]} rotation={[0, it.rot, 0]}>
      {body}
    </group>
  );
}
