import type { Layout } from "../layout/schema.ts";

// Each room's mood and light, from the ambience of the places the client loves (Qloo's ambience tags): a bedroom
// takes the calmest word they have, a kitchen the brightest, a living room the liveliest or warmest. The light
// follows the mood: warm and low for a cosy room, bright and even for a clean one. Pure; the walkthrough shows it
// and the 3D tints each room's light with it.

type Tag = { family?: string; value: string; weight: number; sources: { name: string; layer?: number }[] };

const FITS: [RegExp, string[]][] = [
  [/bed|guest|kids|nursery|primary/, ["relaxing", "calm", "serene", "peaceful", "cozy", "quiet", "intimate", "romantic", "warm"]],
  [/bath|spa|wash|powder/, ["serene", "calm", "relaxing", "clean", "minimalist", "peaceful", "bright"]],
  [/kitchen|pantry|counter|bar|prep/, ["bright", "clean", "lively", "welcoming", "modern", "airy", "social"]],
  [/office|study|work|focus|meeting|desk/, ["quiet", "calm", "focused", "bright", "clean", "modern", "minimalist"]],
  [/living|lounge|family|seating|dining|lobby|reception|cafe|floor|great/, ["lively", "social", "warm", "cozy", "welcoming", "eclectic", "artistic", "vibrant", "relaxing"]],
];

const WARM = /moodily_dark|cozy|intimate|romantic|warm|rustic|moody|candlelit|dark/;
const BRIGHT = /bright|airy|clean|lively|energetic|vibrant|modern|sleek|minimalist|social|focused/;

export type Light = { kelvin: number; color: string; strength: number; say: string };
export type Mood = { word: string; from: string; light: Light };

/** The light for a mood word: warm and low, bright and even, or soft in between. */
export function lightFor(word: string): Light {
  if (WARM.test(word)) return { kelvin: 2700, color: "#ffcf96", strength: 0.75, say: "warm and low: lamps and wall lights on dimmers" };
  if (BRIGHT.test(word)) return { kelvin: 4000, color: "#fff4e4", strength: 1.2, say: "bright and even: ceiling light with task lights" };
  return { kelvin: 3000, color: "#ffe2bd", strength: 1, say: "soft and layered: a ceiling light and a lamp or two" };
}

/** The mood for one room from the client's ambience words (strongest first), or null when they have none. */
export function roomMood(kind: string, tags: Tag[]): Mood | null {
  const ambience = tags
    .filter((t) => t.family === "ambience" && t.sources.some((s) => s.layer !== 3))
    .sort((a, b) => b.weight - a.weight);
  if (!ambience.length) return null;
  const fits = FITS.find(([re]) => re.test(kind.toLowerCase()))?.[1];
  // The room's own order decides (a bedroom wants relaxing before warm); else the strongest word they have.
  const pick = fits?.map((w) => ambience.find((t) => t.value === w)).find(Boolean) ?? ambience[0];
  return { word: pick.value.replaceAll("_", " "), from: pick.sources.find((s) => s.layer !== 3)!.name, light: lightFor(pick.value) };
}

/** Every room's mood, by room id. Halls, stairs and stores are left out. */
export function moodsFor(layout: Layout, tags: Tag[] | undefined): Record<string, Mood> {
  const out: Record<string, Mood> = {};
  if (!tags?.length) return out;
  for (const f of layout.floors)
    for (const s of f.spaces) {
      if (s.zone === "circulation" || /storage|closet|store/.test(s.kind)) continue;
      const m = roomMood(`${s.kind} ${s.name}`, tags);
      if (m) out[s.id] = m;
    }
  return out;
}
