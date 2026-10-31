"use client";

import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { mix } from "@/lib/three/materials";

// Surface textures painted on a canvas in the brief's colours: wood planks, tiles, brick, limewash,
// wallpaper and framed art. Nothing to download, and every one follows the client's palette.

const cache = new Map<string, CanvasTexture>();
const rand = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function paint(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, wrap = true) {
  if (!cache.has(key)) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    draw(c.getContext("2d")!, size);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    if (wrap) t.wrapS = t.wrapT = RepeatWrapping;
    cache.set(key, t);
  }
  return cache.get(key)!;
}

/** A copy of a cached texture tiled to cover w by h metres, at `unit` metres per tile (`unitY` if taller). */
export function tiled(t: Texture, w: number, h: number, unit: number, unitY = unit) {
  const c = t.clone();
  c.repeat.set(w / unit, h / unitY);
  c.needsUpdate = true;
  return c;
}

const tiledCache = new Map<string, Texture>();
/** Like `tiled`, but the same wall size gets the same texture back, for meshes drawn on every render. */
export function tiledOnce(t: Texture, w: number, h: number, unit: number, unitY = unit) {
  const key = `${t.uuid}|${w.toFixed(3)}|${h.toFixed(3)}|${unit}|${unitY}`;
  if (!tiledCache.has(key)) tiledCache.set(key, tiled(t, w, h, unit, unitY));
  return tiledCache.get(key)!;
}

/** Wood planks, 4 boards across one tile, staggered joints and grain. Stretch it along the boards for real lengths. */
export const planks = (wood: string) =>
  paint(`planks${wood}`, 512, (g, s) => {
    const rows = 4;
    const bh = s / rows;
    for (let r = 0; r < rows; r++) {
      const shift = rand(r) * s;
      for (let k = -1; k < 2; k++) {
        const x = shift + k * s * 0.75;
        const tone = mix(wood, rand(r * 7 + k) > 0.5 ? "#ffffff" : "#000000", 0.04 + rand(r * 3 + k) * 0.1);
        g.fillStyle = tone;
        g.fillRect(x, r * bh, s * 0.75, bh);
        g.strokeStyle = mix(tone, "#000000", 0.12);
        g.lineWidth = 1;
        for (let i = 0; i < 9; i++) {
          const y = r * bh + 4 + rand(r * 31 + k * 5 + i) * (bh - 8);
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + s * 0.25, y + 3 - rand(i) * 6, x + s * 0.5, y - 3 + rand(i + 1) * 6, x + s * 0.75, y);
          g.stroke();
        }
        g.fillStyle = mix(wood, "#000000", 0.45);
        g.fillRect(x, r * bh, 2, bh);
      }
      g.fillStyle = mix(wood, "#000000", 0.5);
      g.fillRect(0, r * bh, s, 2);
    }
  });

/** Square tiles with grout lines; zellige gets uneven glaze, marble gets veins. */
export const tiles = (color: string, kind: string, per = 4) =>
  paint(`tiles${color}${kind}${per}`, 512, (g, s) => {
    const t = s / per;
    g.fillStyle = mix(color, "#ffffff", 0.5);
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < per; i++)
      for (let j = 0; j < per; j++) {
        const n = rand(i * 17 + j * 3);
        g.fillStyle = kind === "zellige" ? mix(color, n > 0.5 ? "#ffffff" : "#000000", n * 0.25) : mix(color, "#ffffff", n * 0.06);
        g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
      }
    if (kind === "marble") {
      g.strokeStyle = "rgba(120,120,125,0.35)";
      for (let v = 0; v < 6; v++) {
        g.lineWidth = 1 + rand(v) * 2;
        g.beginPath();
        let x = rand(v + 9) * s;
        g.moveTo(x, 0);
        for (let y = 0; y <= s; y += 32) g.lineTo((x += (rand(v * 9 + y) - 0.5) * 40), y);
        g.stroke();
      }
    }
  });

export const brick = (color: string) =>
  paint(`brick${color}`, 512, (g, s) => {
    g.fillStyle = "#d8d2c8";
    g.fillRect(0, 0, s, s);
    const rows = 8;
    const bh = s / rows;
    for (let r = 0; r < rows; r++)
      for (let k = -1; k < 4; k++) {
        const x = k * (s / 4) + (r % 2) * (s / 8);
        g.fillStyle = mix(color, rand(r * 11 + k) > 0.5 ? "#000000" : "#ffffff", rand(r * 5 + k) * 0.18);
        g.fillRect(x + 3, r * bh + 3, s / 4 - 6, bh - 6);
      }
  });

/** Soft, cloudy limewash or plaster. */
export const limewash = (color: string) =>
  paint(`lime${color}`, 256, (g, s) => {
    g.fillStyle = color;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      const x = rand(i) * s;
      const y = rand(i + 500) * s;
      const r = 10 + rand(i + 900) * 40;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `${mix(color, rand(i + 7) > 0.5 ? "#ffffff" : "#000000", 0.12)}55`);
      grad.addColorStop(1, `${color}00`);
      g.fillStyle = grad;
      for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  });

/** A quiet botanical wallpaper: leaf sprigs on the feature colour. */
export const wallpaper = (ground: string, leaf: string) =>
  paint(`paper${ground}${leaf}`, 512, (g, s) => {
    g.fillStyle = ground;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = g.fillStyle = mix(leaf, ground, 0.35);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const cx = (i + (j % 2) * 0.5) * (s / 4) + s / 8;
        const cy = j * (s / 4) + s / 8;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(cx, cy + 40);
        g.quadraticCurveTo(cx + 8, cy, cx, cy - 40);
        g.stroke();
        for (let k = 0; k < 4; k++)
          for (const side of [-1, 1]) {
            g.beginPath();
            g.ellipse(cx + side * 12, cy + 28 - k * 20, 12, 5, side * 0.6, 0, Math.PI * 2);
            g.fill();
          }
      }
  });

/**
 * A print in the palette, one of eight kinds: 0 arches, 1 hills under a sun, 2 loose shapes, 3 a colour field,
 * 4 a single-line drawing, 5 botanical leaves, 6 the sea at dusk, 7 a Bauhaus grid. `seed` varies it within its kind.
 */
export const art = (colors: string[], kind: number, seed = 0) =>
  paint(
    `art${colors.join()}${kind}.${seed}`,
    512,
    (g, s) => {
      const pick = (i: number) => colors[Math.floor(rand(seed * 13 + kind * 7 + i) * colors.length)];
      const r = (i: number) => rand(seed * 31 + i);
      g.fillStyle = mix(pick(0), "#f4efe6", 0.82);
      g.fillRect(0, 0, s, s);
      switch (kind % 8) {
        case 0: // arches, nested
          for (let i = 0; i < 3; i++) {
            g.fillStyle = pick(i + 1);
            const w = s * (0.56 - i * 0.14);
            const top = s * (0.42 + i * 0.08);
            g.beginPath();
            g.moveTo(s / 2 - w / 2, s);
            g.lineTo(s / 2 - w / 2, top);
            g.arc(s / 2, top, w / 2, Math.PI, 0);
            g.lineTo(s / 2 + w / 2, s);
            g.fill();
          }
          break;
        case 1: // hills under a sun
          g.fillStyle = pick(2);
          g.beginPath();
          g.arc(s * (0.3 + r(1) * 0.4), s * 0.32, s * 0.13, 0, Math.PI * 2);
          g.fill();
          for (let i = 0; i < 3; i++) {
            g.fillStyle = mix(pick(3 + i), "#000000", i * 0.12);
            g.beginPath();
            g.moveTo(0, s);
            g.lineTo(0, s * (0.6 + i * 0.1));
            g.quadraticCurveTo(s * (0.3 + r(i) * 0.4), s * (0.4 + i * 0.12), s, s * (0.62 + i * 0.09));
            g.lineTo(s, s);
            g.fill();
          }
          break;
        case 2: // loose shapes
          for (let i = 0; i < 6; i++) {
            g.fillStyle = pick(i + 4);
            g.globalAlpha = 0.85;
            g.beginPath();
            g.ellipse(r(i) * s, r(i + 20) * s, s * (0.1 + r(i + 40) * 0.15), s * (0.06 + r(i + 3) * 0.1), r(i + 8) * 3, 0, Math.PI * 2);
            g.fill();
          }
          g.globalAlpha = 1;
          break;
        case 3: // a colour field: soft bands, one above the other
          for (let i = 0; i < 3; i++) {
            g.fillStyle = pick(i + 2);
            g.globalAlpha = 0.9;
            g.fillRect(s * 0.1, s * (0.1 + i * 0.29), s * 0.8, s * 0.24);
          }
          g.globalAlpha = 1;
          break;
        case 4: // one unbroken line, like an ink drawing, and a dot of colour
          g.strokeStyle = mix(pick(1), "#000000", 0.55);
          g.lineWidth = s * 0.012;
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(s * 0.15, s * 0.8);
          for (let i = 0; i < 5; i++) g.bezierCurveTo(s * r(i * 3), s * r(i * 3 + 1), s * r(i * 3 + 2), s * r(i * 3 + 5), s * (0.2 + r(i + 9) * 0.6), s * (0.2 + r(i + 11) * 0.6));
          g.stroke();
          g.fillStyle = pick(2);
          g.beginPath();
          g.arc(s * 0.66, s * 0.36, s * 0.09, 0, Math.PI * 2);
          g.fill();
          break;
        case 5: { // botanical: leaves along a stem
          const leaf = mix(pick(1), "#3f6b3a", 0.5);
          g.strokeStyle = mix(leaf, "#000000", 0.3);
          g.lineWidth = s * 0.008;
          g.beginPath();
          g.moveTo(s * 0.5, s * 0.92);
          g.quadraticCurveTo(s * 0.46, s * 0.5, s * 0.55, s * 0.1);
          g.stroke();
          for (let i = 0; i < 9; i++) {
            const side = i % 2 ? 1 : -1;
            g.fillStyle = mix(leaf, "#ffffff", r(i) * 0.25);
            g.save();
            g.translate(s * 0.5, s * (0.92 - (0.15 + i * 0.085) * 0.85));
            g.rotate(side * (0.9 + r(i + 5) * 0.4));
            g.beginPath();
            g.ellipse(0, -s * 0.07, s * 0.035, s * 0.08, 0, 0, Math.PI * 2);
            g.fill();
            g.restore();
          }
          break;
        }
        case 6: { // the sea at dusk, like a photograph
          const sky = g.createLinearGradient(0, 0, 0, s * 0.6);
          sky.addColorStop(0, mix(pick(1), "#2c3e5c", 0.5));
          sky.addColorStop(1, mix(pick(2), "#f2b27a", 0.55));
          g.fillStyle = sky;
          g.fillRect(0, 0, s, s * 0.6);
          const sea = g.createLinearGradient(0, s * 0.6, 0, s);
          sea.addColorStop(0, mix(pick(1), "#2f4a66", 0.6));
          sea.addColorStop(1, mix(pick(1), "#0f1d2e", 0.7));
          g.fillStyle = sea;
          g.fillRect(0, s * 0.6, s, s * 0.4);
          g.fillStyle = "#ffe2b0";
          g.beginPath();
          g.arc(s * (0.35 + r(2) * 0.3), s * 0.6, s * 0.07, Math.PI, 0);
          g.fill();
          g.globalAlpha = 0.5;
          for (let i = 0; i < 8; i++) g.fillRect(s * (0.3 + r(i) * 0.4), s * (0.63 + i * 0.04), s * (0.05 + r(i + 4) * 0.12), s * 0.006);
          g.globalAlpha = 1;
          break;
        }
        default: { // a Bauhaus grid of circles, halves and squares
          const n = 3;
          const c = s / n;
          for (let i = 0; i < n * n; i++) {
            const x = (i % n) * c;
            const y = Math.floor(i / n) * c;
            g.fillStyle = mix(pick(i + 1), "#f4efe6", 0.15);
            g.beginPath();
            if (r(i) < 0.4) g.arc(x + c / 2, y + c / 2, c * 0.38, 0, Math.PI * 2);
            else if (r(i) < 0.75) g.arc(x + c / 2, y + c, c * 0.45, Math.PI, 0);
            else g.rect(x + c * 0.15, y + c * 0.15, c * 0.7, c * 0.7);
            g.fill();
          }
        }
      }
    },
    false,
  );

/** A house nameplate: the number large, the name below it, cream letters on a dark plate. */
export const plate = (number: string, name: string) =>
  paint(
    `plate${number}|${name}`,
    512,
    (g, s) => {
      g.fillStyle = "#23262b";
      g.fillRect(0, 0, s, s);
      g.strokeStyle = "#c9a46a";
      g.lineWidth = s * 0.012;
      g.strokeRect(s * 0.04, s * 0.04, s * 0.92, s * 0.92);
      g.fillStyle = "#f1ece2";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `600 ${Math.round(s * 0.34)}px Georgia, serif`;
      g.fillText(number, s / 2, s * 0.42);
      g.font = `${Math.round(s * 0.085)}px Georgia, serif`;
      g.fillText(name.toUpperCase(), s / 2, s * 0.78, s * 0.84);
    },
    false,
  );

/** A shopfront sign, SIGN times wider than tall: drawn squeezed into a square, so it reads true on the long board. */
export const SIGN = 4.5;
export const signboard = (name: string) =>
  paint(
    `sign|${name}`,
    1024,
    (g, s) => {
      g.fillStyle = "#1f2a24";
      g.fillRect(0, 0, s, s);
      g.save();
      g.scale(1 / SIGN, 1);
      const w = s * SIGN;
      g.strokeStyle = "#d8b878";
      g.lineWidth = s * 0.03;
      g.strokeRect(s * 0.06, s * 0.08, w - s * 0.12, s * 0.84);
      g.fillStyle = "#f6ecd8";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `600 ${Math.round(s * 0.46)}px Georgia, serif`;
      g.fillText(name.toUpperCase(), w / 2, s * 0.47, w * 0.86);
      g.fillStyle = "#d8b878";
      g.font = `${Math.round(s * 0.14)}px Georgia, serif`;
      g.fillText("COFFEE  ·  KITCHEN  ·  OPEN LATE", w / 2, s * 0.8, w * 0.8);
      g.restore();
    },
    false,
  );

/** Rug weaves: a striped kilim for boho, a medallion for classic. */
export const rug = (ground: string, ink: string, kind: "kilim" | "medallion") =>
  paint(
    `rug${ground}${ink}${kind}`,
    256,
    (g, s) => {
      g.fillStyle = ground;
      g.fillRect(0, 0, s, s);
      g.strokeStyle = g.fillStyle = ink;
      g.lineWidth = 6;
      g.strokeRect(10, 10, s - 20, s - 20);
      if (kind === "kilim")
        for (let i = 0; i < 7; i++) {
          const y = 30 + i * 32;
          g.fillStyle = i % 2 ? ink : mix(ink, ground, 0.5);
          for (let x = 24; x < s - 24; x += 24) {
            g.beginPath();
            g.moveTo(x, y + 10);
            g.lineTo(x + 12, y);
            g.lineTo(x + 24, y + 10);
            g.lineTo(x + 12, y + 20);
            g.fill();
          }
        }
      else {
        g.lineWidth = 3;
        g.strokeRect(26, 26, s - 52, s - 52);
        g.beginPath();
        g.ellipse(s / 2, s / 2, s * 0.22, s * 0.16, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = ground;
        g.beginPath();
        g.ellipse(s / 2, s / 2, s * 0.12, s * 0.08, 0, 0, Math.PI * 2);
        g.fill();
      }
    },
    false,
  );
