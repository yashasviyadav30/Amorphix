import type { Layout, Shell } from "../layout/schema.ts";
import type { Item } from "../three/furniture.ts";
import { CARE_SCORE, lightFit, plantOf, PLANTS, type Light, type Plant } from "./plants.ts";

// The greenery score: how much living green a design has, and how likely it is to thrive. Each lived-in room is
// scored on plant cover (40%), light fit (25%), variety (20%) and care (15%); the project is the area-weighted
// average, with the garden counted when the lot has one. Every room says one way to raise its score.

const LIVED_IN = new Set(["living", "lounge", "bedroom", "guest-room", "dining", "office", "reception", "meeting", "workspace", "kitchen", "counter", "retail"]);
const M2_PER_PLANT = 8;
const WINDOW_HEIGHT = 1.4;

export type RoomGreen = { id: string; name: string; area: number; light: Light; plants: number; pick: Plant | null; score: number; tip: string | null };
/** What the client chose to raise the score: extra plants per room, a plant swapped in per room, outdoor planting. */
export type GreenChoices = { extra?: Record<string, number>; swap?: Record<string, string>; outdoor?: boolean };

export type Green = { exact: number; score: number; rooms: RoomGreen[]; species: string[]; unknown: string[]; garden: { area: number; share: number } | null };

/** How much daylight a room gets: window area against floor area (the usual daylight rule of thumb). */
export function lightOf(layout: Layout, roomId: string): Light {
  for (const f of layout.floors) {
    const room = f.spaces.find((s) => s.id === roomId);
    if (!room) continue;
    const glass = f.openings.filter((o) => o.type === "window" && o.between.includes(roomId)).reduce((a, o) => a + o.width * WINDOW_HEIGHT, 0);
    const ratio = glass / (room.rect.w * room.rect.h);
    return ratio >= 0.15 ? "bright" : ratio >= 0.07 ? "medium" : "low";
  }
  return "low";
}

/**
 * Pure: the score for a layout, its placed furniture (plants are items with role "plant") and the brief's plants.
 * `lot` is the site; when it is bigger than the building, the rest is garden.
 */
export function greenery(layout: Layout, items: Item[], briefPlants: { name: string }[], lot?: Shell | null, choices: GreenChoices = {}): Green {
  const swaps = Object.values(choices.swap ?? {}).map((n) => plantOf(n)).filter((p): p is Plant => !!p);
  const known = [...briefPlants.map((p) => plantOf(p.name)).filter((p): p is Plant => !!p), ...swaps];
  const species = [...new Set(known.map((p) => p.name))];
  const unknown = briefPlants.filter((p) => !plantOf(p.name)).map((p) => p.name);
  const variety = Math.min(1, species.length / 4);
  const rooms: RoomGreen[] = [];
  for (const f of layout.floors)
    for (const s of f.spaces.filter((x) => LIVED_IN.has(x.kind))) {
      const area = s.rect.w * s.rect.h;
      const light = lightOf(layout, s.id);
      const plants = items.filter((i) => i.room === s.id && i.level === f.level && i.role === "plant").length;
      const cover = Math.min(1, (plants * M2_PER_PLANT) / area);
      // The brief's plant that suits this room best (its light first, then the easiest to keep).
      // Among plants that suit the light, the one that wants the most of it: a bright room gets the monstera, not
      // the snake plant that would live anywhere.
      const need = (p: Plant) => ["low", "medium", "bright"].indexOf(p.light);
      const chosen = choices.swap?.[s.id] ? plantOf(choices.swap[s.id]) : null;
      const pick = chosen ?? [...known].sort((a, b) => lightFit(b, light) - lightFit(a, light) || need(b) - need(a) || CARE_SCORE[b.care] - CARE_SCORE[a.care])[0] ?? null;
      const fit = pick ? lightFit(pick, light) : 0.6;
      const care = pick ? CARE_SCORE[pick.care] : 0.75;
      const score = 100 * (0.4 * cover + 0.25 * fit + 0.2 * variety + 0.15 * care);
      // The one change that would raise it most.
      // Suggest one of their own plants when it suits this light; otherwise the easiest plant that does.
      const easyHere = (pick && lightFit(pick, light) === 1 ? pick : null) ?? PLANTS.find((p) => p.care === "easy" && lightFit(p, light) === 1)!;
      const tip =
        cover < 1
          ? `Add ${Math.ceil(area / M2_PER_PLANT) - plants === 1 ? "one more plant" : `${Math.ceil(area / M2_PER_PLANT) - plants} more plants`}${light !== "low" ? " near the window" : ""}, such as a ${easyHere.name.toLowerCase()}.`
          : fit < 1
            ? `This room gets ${light} light: a ${easyHere.name.toLowerCase()} will do better here than a ${pick!.name.toLowerCase()}.`
            : null;
      rooms.push({ id: s.id, name: s.name, area, light, plants, pick, score: Math.round(score), tip });
    }
  const inside = rooms.reduce((a, r) => a + r.area, 0);
  let score = inside ? rooms.reduce((a, r) => a + r.score * r.area, 0) / inside : 0;
  // Garden: the lot outside the footprint. A garden that is most of the lot lifts the score; none leaves it as is.
  let garden: Green["garden"] = null;
  if (lot && lot.width * lot.depth > layout.shell.width * layout.shell.depth * 1.05) {
    const total = lot.width * lot.depth;
    const area = total - layout.shell.width * layout.shell.depth;
    garden = { area, share: area / total };
    // Planters and climbers along the boundary count as a fully planted edge.
    score = 0.8 * score + 0.2 * 100 * (choices.outdoor ? 1 : Math.min(1, garden.share / 0.5));
  }
  return { exact: score, score: Math.round(score), rooms, species, unknown, garden };
}
