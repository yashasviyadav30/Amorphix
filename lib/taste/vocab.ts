import type { Family } from "./types.ts";

// The style words Amorphix's taste engine can find, each with the prompt its vector is made from. The words are the
// ones the rest of the app turns into decisions: materials and furniture style (decor, aesthetic), each room's mood
// and light (ambience), and the overall feeling (tone).
export type Word = { family: Family; value: string; prompt: string };

const room = (s: string) => `a photo of an interior with ${s}`;

export const VOCAB: Word[] = [
  // decor: the look of the space
  { family: "decor", value: "mid_century_modern", prompt: room("mid-century modern furniture, teak wood and tapered legs") },
  { family: "decor", value: "old_hollywood", prompt: room("old Hollywood glamour, velvet, brass and dark lacquer") },
  { family: "decor", value: "art_deco", prompt: room("art deco geometry, gold trim and marble") },
  { family: "decor", value: "scandinavian", prompt: room("Scandinavian design, light oak, white walls and simple forms") },
  { family: "decor", value: "japandi", prompt: room("Japandi style, low furniture, natural wood and muted tones") },
  { family: "decor", value: "industrial", prompt: room("industrial loft style, exposed brick, concrete and black steel") },
  { family: "decor", value: "bohemian", prompt: room("bohemian style, rattan, layered rugs, plants and global textiles") },
  { family: "decor", value: "coastal", prompt: room("coastal style, white linen, light blue and driftwood") },
  { family: "decor", value: "farmhouse", prompt: room("modern farmhouse style, shiplap, wood beams and vintage pieces") },
  { family: "decor", value: "rustic", prompt: room("rustic style, rough timber, stone and warm wool") },
  { family: "decor", value: "mediterranean", prompt: room("Mediterranean style, terracotta tiles, arches and limewash walls") },
  { family: "decor", value: "traditional", prompt: room("traditional style, classic moulding, antiques and rich fabrics") },
  { family: "decor", value: "contemporary", prompt: room("contemporary style, sleek surfaces and neutral colours") },
  { family: "decor", value: "minimalist", prompt: room("minimalist design, very few objects and clean empty space") },
  { family: "decor", value: "maximalist", prompt: room("maximalist design, bold patterns, colour and many collected objects") },
  { family: "decor", value: "wabi_sabi", prompt: room("wabi-sabi style, handmade ceramics, raw plaster and imperfect textures") },
  { family: "decor", value: "botanical", prompt: room("lots of indoor plants, botanical prints and green") },
  { family: "decor", value: "vintage", prompt: room("vintage furniture and retro objects") },
  { family: "decor", value: "luxurious", prompt: room("luxurious finishes, marble, gold and plush upholstery") },
  { family: "decor", value: "eclectic", prompt: room("an eclectic mix of styles, art and colour") },
  // aesthetic: materials and lines
  { family: "aesthetic", value: "natural_materials", prompt: room("natural materials, wood, linen, stone and cane") },
  { family: "aesthetic", value: "clean_lines", prompt: room("clean straight lines and uncluttered surfaces") },
  { family: "aesthetic", value: "brass_accents", prompt: room("brass and gold accents on lights and hardware") },
  { family: "aesthetic", value: "marble", prompt: room("marble counters and marble surfaces") },
  { family: "aesthetic", value: "terracotta", prompt: room("terracotta floor tiles and clay tones") },
  { family: "aesthetic", value: "fluted_panels", prompt: room("fluted wood panels and slatted walls") },
  { family: "aesthetic", value: "dark_wood", prompt: room("dark walnut wood furniture and panelling") },
  { family: "aesthetic", value: "light_wood", prompt: room("pale oak and birch wood") },
  { family: "aesthetic", value: "velvet", prompt: room("velvet sofas and rich upholstery") },
  { family: "aesthetic", value: "concrete", prompt: room("polished concrete floors and walls") },
  { family: "aesthetic", value: "elegant", prompt: room("an elegant, refined arrangement") },
  { family: "aesthetic", value: "colorful", prompt: room("bright saturated colours") },
  { family: "aesthetic", value: "monochrome", prompt: room("a black and white monochrome palette") },
  { family: "aesthetic", value: "earthy", prompt: room("earthy tones, sand, rust and olive") },
  // ambience: the mood of a room
  { family: "ambience", value: "cozy", prompt: room("a cozy, warm and snug feeling, soft lamps and blankets") },
  { family: "ambience", value: "relaxing", prompt: room("a relaxing, restful calm atmosphere") },
  { family: "ambience", value: "serene", prompt: room("a serene, peaceful and quiet atmosphere") },
  { family: "ambience", value: "romantic", prompt: room("a romantic, intimate candlelit atmosphere") },
  { family: "ambience", value: "lively", prompt: room("a lively, social atmosphere full of people") },
  { family: "ambience", value: "bright", prompt: room("bright natural daylight and white surfaces") },
  { family: "ambience", value: "airy", prompt: room("an airy open space with high ceilings and big windows") },
  { family: "ambience", value: "moody", prompt: room("a moody, dark and dramatic atmosphere") },
  { family: "ambience", value: "welcoming", prompt: room("a welcoming, homey and friendly feeling") },
  { family: "ambience", value: "focused", prompt: room("a quiet focused workspace") },
  { family: "ambience", value: "artistic", prompt: room("an artistic creative studio atmosphere") },
  { family: "ambience", value: "vibrant", prompt: room("a vibrant energetic atmosphere") },
  // tone: the overall feeling, used lightly
  { family: "tone", value: "warm", prompt: room("a warm feeling") },
  { family: "tone", value: "sophisticated", prompt: room("a sophisticated, grown-up feeling") },
  { family: "tone", value: "playful", prompt: room("a playful, fun feeling") },
  { family: "tone", value: "calm", prompt: room("a calm feeling") },
];
