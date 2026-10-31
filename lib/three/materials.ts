import type { Role } from "./furniture.ts";

// Colours for the 3D model, taken from the design brief's palette so the model looks like the brief.
type Swatch = { hex: string; role: string };

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
export const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const mix = (a: string, b: string, t: number) => toHex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));

export type Scheme = { wall: string; floor: string; bathFloor: string; exterior: string; roof: string; ground: string } & Record<Role, string>;

const FALLBACK: Scheme = {
  wall: "#f2efe9", floor: "#a07850", bathFloor: "#d9d6d0", exterior: "#e9e5dd", roof: "#3c4048", ground: "#7da36a",
  wood: "#a07850", textile: "#c9b8a3", metal: "#8a8f96", accent: "#3a6ea5", base: "#e4e1db", plant: "#4f7a4a", pot: "#b9a48a",
};

export function scheme(palette: Swatch[] | undefined): Scheme {
  if (!palette?.length) return FALLBACK;
  const by = (role: string) => palette.find((c) => c.role === role)?.hex;
  const lightest = [...palette].sort((a, b) => luminance(b.hex) - luminance(a.hex))[0].hex;
  const darkest = [...palette].sort((a, b) => luminance(a.hex) - luminance(b.hex))[0].hex;
  // Walls are the palette's lightest colour, pushed toward white so rooms stay bright.
  const wall = mix(lightest, "#ffffff", luminance(lightest) > 0.8 ? 0.2 : 0.65);
  const wood = by("wood") ?? FALLBACK.wood;
  return {
    wall,
    floor: wood,
    bathFloor: mix(by("base") ?? lightest, "#ffffff", 0.5),
    exterior: mix(by("base") ?? lightest, "#ffffff", 0.35),
    roof: mix(darkest, "#000000", 0.1),
    ground: FALLBACK.ground,
    wood,
    textile: by("textile") ?? mix(lightest, wood, 0.35),
    metal: by("metal") ?? FALLBACK.metal,
    accent: by("accent") ?? FALLBACK.accent,
    base: mix(by("base") ?? lightest, "#ffffff", 0.3),
    plant: by("green") ?? FALLBACK.plant,
    pot: mix(wood, "#ffffff", 0.35),
  };
}

// How the walls are dressed, read from the brief's words: a feature-wall finish, its colour, the tile for
// kitchens and baths, curtain fabric, and the colours the framed art is painted in.
export type Finish = "paint" | "panel" | "plaster" | "brick" | "wallpaper";
export type Style = "midcentury" | "industrial" | "scandi" | "boho" | "classic" | "modern";
export type Look = {
  finish: Finish; feature: string; tile: string; tileKind: "plain" | "zellige" | "marble" | "terracotta"; curtain: string; frame: string; art: string[];
  /** Furniture style, and whether the space leans green (more plants) or cozy (throws and cushions). */
  style: Style; lush: boolean; cozy: boolean;
  /** Things the user named (places, brands) whose Qloo tags chose the style, strongest first. */
  because: string[];
  /** Brands Qloo matched to the films and music they love, which also pointed to this style. */
  matched: string[];
};
type BriefWords = { name?: string; summary?: string; palette?: Swatch[]; materials?: { name: string; where: string }[] };
// Layer 3 sources are brands Qloo matched to the user's culture picks, not things they named themselves.
type Taste = { tags: { value: string; weight: number; sources: { name: string; layer?: number }[] }[]; brands: { name: string; aesthetic: string[] }[] };

const STYLES: [Style, RegExp][] = [
  ["midcentury", /mid.?century|retro|atomic|sixties|seventies|danish/],
  ["industrial", /industrial|loft|exposed|raw|edgy|urban|grunge|warehouse/],
  ["scandi", /scandi|nordic|minimal|airy|hygge|serene|calm|clean/],
  ["boho", /boho|bohemian|eclectic|rattan|global|eccentric|artsy|quirky|maximal|whimsical/],
  ["classic", /classic|traditional|elegant|luxur|opulent|ornate|antique|glam|regal|vintage/],
  ["modern", /modern|contemporary|sleek|chic|polished/],
];
const LUSH = /green|botanical|garden|lush|natural|plant|tropical|outdoor/;
const COZY = /cozy|cosy|warm|intimate|homey|comfort|snug|moody/;

/**
 * Scores each furniture style from the Qloo taste tags (by weight), brand aesthetics and the brief's words.
 * The brief's style name (itself written from those tags and the interview) counts most, so the 3D model
 * always matches the style the client was shown.
 */
export function styleOf(taste: Taste | null | undefined, words: string, name = "") {
  const score = new Map<Style, number>();
  const credit = new Map<Style, Map<string, number>>();
  const matchedCredit = new Map<Style, Map<string, number>>();
  const bump = (m: Map<Style, Map<string, number>>, style: Style, names: string[], w: number) => {
    const c = m.get(style) ?? new Map<string, number>();
    for (const n of names) c.set(n, (c.get(n) ?? 0) + w);
    m.set(style, c);
  };
  const add = (text: string, w: number, loved: string[] = [], matched: string[] = []) => {
    for (const [style, re] of STYLES)
      if (re.test(text)) {
        score.set(style, (score.get(style) ?? 0) + w);
        bump(credit, style, loved, w);
        bump(matchedCredit, style, matched, w);
      }
  };
  for (const t of taste?.tags ?? [])
    add(
      t.value.replaceAll("_", " ").toLowerCase(),
      t.weight,
      t.sources.filter((s) => s.layer !== 3).map((s) => s.name),
      t.sources.filter((s) => s.layer === 3).map((s) => s.name),
    );
  for (const b of taste?.brands ?? []) for (const a of b.aesthetic) add(a.replaceAll("_", " ").toLowerCase(), 0.5, [], [b.name]);
  add(words, 1);
  add(name.toLowerCase(), 8);
  const style = [...score].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "modern";
  const top = (m: Map<Style, Map<string, number>>, n: number) => [...(m.get(style) ?? [])].sort((a, b) => b[1] - a[1]).map(([x]) => x).slice(0, n);
  const because = top(credit, 3);
  const matched = top(matchedCredit, 2).filter((x) => !because.includes(x));
  const all = [words, ...(taste?.tags ?? []).map((t) => t.value.replaceAll("_", " "))].join(" ").toLowerCase();
  return { style, because, matched, lush: LUSH.test(all), cozy: COZY.test(all) };
}

export function look(brief: BriefWords | null | undefined, taste?: Taste | null): Look {
  const k = scheme(brief?.palette);
  const words = [brief?.name, brief?.summary, ...(brief?.materials ?? []).map((m) => `${m.name} ${m.where}`)].join(" ").toLowerCase();
  const has = (re: RegExp) => re.test(words);
  const finish: Finish = has(/panel|slat|wainscot|batten|fluted|reeded/)
    ? "panel"
    : has(/brick/)
      ? "brick"
      : has(/wallpaper|botanical print|patterned wall/)
        ? "wallpaper"
        : has(/limewash|plaster|venetian|tadelakt|stucco|clay wall|microcement/)
          ? "plaster"
          : "paint";
  const tileKind = has(/zellige/) ? "zellige" : has(/marble/) ? "marble" : has(/terracotta|saltillo/) ? "terracotta" : "plain";
  const tile = { zellige: mix(k.accent, k.plant, 0.4), marble: "#ecebe8", terracotta: "#c0673f", plain: mix(k.base, "#ffffff", 0.4) }[tileKind];
  const feature =
    finish === "panel" ? k.wood : finish === "brick" ? "#9a5a43" : mix(brief?.palette?.find((c) => c.role === "green")?.hex ?? k.accent, k.wall, 0.3);
  const frame = has(/brass|gold|bronze/) ? "#b08d57" : luminance(k.wood) < 0.25 ? k.wood : "#232323";
  const art = [...new Set([k.accent, k.plant, k.textile, k.wood, k.metal])];
  return { finish, feature, tile, tileKind, curtain: mix(k.textile, "#ffffff", 0.35), frame, art, ...styleOf(taste, words, brief?.name) };
}
