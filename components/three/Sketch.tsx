"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Effect, EffectAttribute } from "postprocessing";
import { useEffect, useMemo } from "react";
import { Color, MeshNormalMaterial, Uniform } from "three";

// The hand-drawn look: the scene is drawn with its surface directions as colours, and this pass turns every sharp
// change in direction or depth into a slightly wobbly ink line, hatches the sides facing away from the light in
// blue, and lays it on paper. A pen sweep reveals the drawing the first time it appears.
const FRAG = /* glsl */ `
uniform vec3 paper;
uniform vec3 ink;
uniform vec3 blue;
uniform float reveal;
uniform float solid;
uniform float lineScale;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 nrm(vec2 uv) { return texture2D(inputBuffer, uv).rgb * 2.0 - 1.0; }
float far(vec2 uv) { return -getViewZ(readDepth(uv)); }
float lines(vec2 q, vec2 ox, vec2 oy) {
  float edgeN = length(nrm(q - ox) - nrm(q + ox)) + length(nrm(q - oy) - nrm(q + oy));
  float dc = max(far(q), 0.001);
  float edgeD = (abs(far(q - ox) - far(q + ox)) + abs(far(q - oy) - far(q + oy))) / dc;
  return max(smoothstep(0.3, 0.75, edgeN), smoothstep(0.02, 0.07, edgeD));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  // Measured in screen pixels, so a picture drawn at twice the resolution keeps the same line weight and wobble.
  vec2 px = texelSize * lineScale;
  vec2 sp = uv * resolution / lineScale;
  // a hand's wobble: sample the edges a little off the true line, varying slowly along it
  vec2 q = uv + (vec2(noise(sp / 70.0), noise(sp / 70.0 + 31.7)) - 0.5) * px * 5.0;
  vec2 ox = vec2(px.x * 1.2, 0.0);
  vec2 oy = vec2(0.0, px.y * 1.2);

  float edge = lines(q, ox, oy);
  // a second, lighter stroke a touch off the first, the way a sketch goes over its lines twice
  vec2 q2 = uv + (vec2(noise(sp / 45.0 + 9.1), noise(sp / 45.0 + 4.3)) - 0.5) * px * 6.0;
  edge = max(edge * (0.6 + 0.4 * noise(sp / 12.0)), lines(q2, ox, oy) * 0.45);

  // hatching: sides turned away from the light get diagonal strokes, the darkest get a second, crossing set
  float empty = step(0.99999, readDepth(uv));
  vec3 n = normalize(nrm(uv));
  float tone = 1.0 - clamp(dot(n, normalize(vec3(0.45, 0.8, 0.4))) * 0.5 + 0.5, 0.0, 1.0);
  float d1 = abs(fract((sp.x + sp.y) / 9.0) - 0.5) * 9.0;
  float d2 = abs(fract((sp.x - sp.y) / 11.0) - 0.5) * 11.0;
  float hatch = (1.0 - smoothstep(0.3, 0.9, d1)) * smoothstep(0.5, 0.7, tone);
  hatch = max(hatch, (1.0 - smoothstep(0.3, 0.9, d2)) * smoothstep(0.7, 0.88, tone));
  // strokes fade in and out along their length, like a hand lifting the pencil
  hatch *= (1.0 - empty) * smoothstep(0.25, 0.75, noise(sp / 26.0));

  vec3 page = paper * (0.975 + 0.025 * noise(sp / 1.5));
  vec3 color = mix(page, blue, hatch * 0.35);
  color = mix(color, ink, edge);

  // the pen sweep, top left to bottom right, with a blue nib glow at its front
  float sweep = uv.x * 0.6 + (1.0 - uv.y) * 0.4 + (noise(sp / 50.0) - 0.5) * 0.12;
  float drawn = smoothstep(sweep - 0.04, sweep, reveal);
  color = mix(page, color, drawn);
  color = mix(color, blue, edge * (1.0 - smoothstep(0.0, 0.05, abs(reveal - sweep))) * 0.8);
  // where nothing was drawn the page shows through, except the outline itself
  float alpha = max(1.0 - empty, edge * drawn);
  // On paper (for a picture to save), the empty space is the page itself.
  if (solid > 0.5) {
    outputColor = vec4(mix(color, mix(page, ink, edge * drawn), empty), 1.0);
    return;
  }
  vec3 shown = mix(color, ink, empty);
  outputColor = vec4(shown * alpha, alpha);
}
`;

class SketchEffect extends Effect {
  constructor() {
    super("SketchEffect", FRAG, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ["paper", new Uniform(new Color("#f4f7fb"))],
        ["ink", new Uniform(new Color("#0e1a2b"))],
        ["blue", new Uniform(new Color("#2f6fed"))],
        ["reveal", new Uniform(0)],
        ["solid", new Uniform(0)],
        ["lineScale", new Uniform(1)],
      ]),
    });
  }
}

/** The theme's paper, ink and accent, read from the page so the drawing follows light and dark mode. */
function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return { paper: get("--paper", "#f4f7fb"), ink: get("--ink", "#0e1a2b"), blue: get("--accent", "#2f6fed") };
}

/**
 * Put inside an EffectComposer, with <SketchMaterial /> in the scene. `print`: a picture to save, so ink and blue on
 * white paper whatever the theme, already fully drawn.
 */
export function SketchFx({ print = false }: { print?: boolean }) {
  const effect = useMemo(() => new SketchEffect(), []);
  useEffect(() => {
    const c = print ? { paper: "#ffffff", ink: "#0e1a2b", blue: "#2f6fed" } : themeColors();
    effect.uniforms.get("solid")!.value = print ? 1 : 0;
    // Pictures to save are drawn at twice the resolution (see HouseScene), so the lines are drawn twice as wide.
    effect.uniforms.get("lineScale")!.value = print ? 2 : 1;
    if (print) effect.uniforms.get("reveal")!.value = 1.2;
    // the composer works in linear colour; the page's colours are sRGB
    (effect.uniforms.get("paper")!.value as Color).set(c.paper).convertSRGBToLinear();
    (effect.uniforms.get("ink")!.value as Color).set(c.ink).convertSRGBToLinear();
    (effect.uniforms.get("blue")!.value as Color).set(c.blue).convertSRGBToLinear();
    return () => effect.dispose();
  }, [effect, print]);
  useFrame((_, dt) => {
    const r = effect.uniforms.get("reveal")!;
    if (r.value < 1.2) r.value = Math.min(1.2, r.value + dt / 2.6);
  });
  return <primitive object={effect} dispose={null} />;
}

/** Draws every object with its surface directions as colours, which is what the sketch pass reads. */
export function SketchMaterial() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const m = new MeshNormalMaterial();
    scene.overrideMaterial = m;
    return () => {
      scene.overrideMaterial = null;
      m.dispose();
    };
  }, [scene]);
  return null;
}
