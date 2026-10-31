// Common indoor plants and what they need. Light: the least a plant takes (low copes with a north room, bright
// wants a sunny window). Care: easy survives being forgotten, hard needs a regular hand. From standard horticultural
// guidance (RHS, university extension sheets); names include the common aliases people use.

export type Light = "low" | "medium" | "bright";
export type Care = "easy" | "moderate" | "hard";
export type Plant = { name: string; aka: string[]; light: Light; care: Care };

export const PLANTS: Plant[] = [
  { name: "Snake plant", aka: ["sansevieria", "dracaena trifasciata", "mother-in-law"], light: "low", care: "easy" },
  { name: "ZZ plant", aka: ["zamioculcas", "zz"], light: "low", care: "easy" },
  { name: "Pothos", aka: ["epipremnum", "money plant", "devil's ivy"], light: "low", care: "easy" },
  { name: "Cast iron plant", aka: ["aspidistra"], light: "low", care: "easy" },
  { name: "Chinese evergreen", aka: ["aglaonema"], light: "low", care: "easy" },
  { name: "Parlour palm", aka: ["parlor palm", "chamaedorea"], light: "low", care: "easy" },
  { name: "Peace lily", aka: ["spathiphyllum"], light: "low", care: "moderate" },
  { name: "Heartleaf philodendron", aka: ["philodendron"], light: "medium", care: "easy" },
  { name: "Spider plant", aka: ["chlorophytum"], light: "medium", care: "easy" },
  { name: "Rubber plant", aka: ["ficus elastica", "rubber tree"], light: "medium", care: "easy" },
  { name: "Monstera", aka: ["monstera deliciosa", "swiss cheese plant"], light: "medium", care: "moderate" },
  { name: "Boston fern", aka: ["fern", "nephrolepis"], light: "medium", care: "moderate" },
  { name: "Calathea", aka: ["prayer plant", "maranta", "goeppertia"], light: "medium", care: "hard" },
  { name: "Dracaena", aka: ["corn plant", "dragon tree", "dracaena marginata"], light: "medium", care: "easy" },
  { name: "Areca palm", aka: ["dypsis", "butterfly palm"], light: "bright", care: "moderate" },
  { name: "Kentia palm", aka: ["howea"], light: "medium", care: "easy" },
  { name: "Fiddle leaf fig", aka: ["ficus lyrata"], light: "bright", care: "hard" },
  { name: "Bird of paradise", aka: ["strelitzia"], light: "bright", care: "moderate" },
  { name: "Aloe vera", aka: ["aloe"], light: "bright", care: "easy" },
  { name: "Jade plant", aka: ["crassula"], light: "bright", care: "easy" },
  { name: "Olive tree", aka: ["olea", "olive"], light: "bright", care: "hard" },
  { name: "Tulsi", aka: ["holy basil"], light: "bright", care: "moderate" },
  { name: "Herbs", aka: ["basil", "mint", "rosemary", "thyme", "herb"], light: "bright", care: "moderate" },
  { name: "String of pearls", aka: ["senecio"], light: "bright", care: "hard" },
  { name: "Cactus", aka: ["cacti", "succulent", "succulents"], light: "bright", care: "easy" },
  { name: "English ivy", aka: ["hedera", "ivy"], light: "medium", care: "moderate" },
  { name: "Bamboo palm", aka: ["chamaedorea seifrizii", "reed palm"], light: "low", care: "moderate" },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z' -]/g, " ").replace(/\s+/g, " ").trim();

/** The plant a name means ("Monstera Deliciosa", "money plant"), or null if we don't know it. */
export function plantOf(name: string): Plant | null {
  const n = norm(name);
  return (
    PLANTS.find((p) => norm(p.name) === n || p.aka.some((a) => norm(a) === n)) ??
    PLANTS.find((p) => [p.name, ...p.aka].some((a) => n.includes(norm(a)))) ??
    null
  );
}

const ORDER: Light[] = ["low", "medium", "bright"];
/** How well a plant suits a room's light, 0 to 1: enough light is 1, one step short 0.5, two steps short 0. */
export const lightFit = (plant: Plant, room: Light) => {
  const short = ORDER.indexOf(plant.light) - ORDER.indexOf(room);
  return short <= 0 ? 1 : short === 1 ? 0.5 : 0;
};
export const CARE_SCORE: Record<Care, number> = { easy: 1, moderate: 0.75, hard: 0.4 };
