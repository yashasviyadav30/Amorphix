// Home brands Amorphix can furnish from, each with the look it is known for. The description is embedded with the same
// model as photos and style words, so a brand is ranked by how close its look sits to a person's taste.
// `level` is its price, 1 ($) to 4 ($$$$); `makes` is what it sells (most sell every kind of furniture).
export type BrandEntry = { id: string; name: string; level: 1 | 2 | 3 | 4; makes?: string[]; aesthetic: string[]; prompt: string };

export const FURNITURE = ["sofa", "armchair", "coffee_table", "tv_console", "rug", "lighting", "bed", "wardrobe", "dining", "sideboard", "desk", "shelving", "mirror"];
export const makesOf = (b: BrandEntry) => b.makes ?? FURNITURE;

const look = (s: string) => `a photo of furniture and decor with ${s}`;

export const BRANDS: BrandEntry[] = [
  { id: "west-elm", level: 3, name: "West Elm", aesthetic: ["mid_century_modern", "clean_lines"], prompt: look("mid-century modern lines, walnut wood and brass details") },
  { id: "pottery-barn", level: 3, name: "Pottery Barn", aesthetic: ["traditional", "cozy"], prompt: look("classic comfortable American style, linen and warm wood") },
  { id: "cb2", level: 3, name: "CB2", aesthetic: ["contemporary", "sleek"], prompt: look("modern sleek pieces, marble, black metal and bold forms") },
  { id: "crate-and-barrel", level: 3, name: "Crate & Barrel", aesthetic: ["contemporary", "natural_materials"], prompt: look("relaxed modern design and natural materials") },
  { id: "ikea", level: 1, makes: [...FURNITURE, "office_furniture", "planter", "washer"], name: "IKEA", aesthetic: ["scandinavian", "light_wood"], prompt: look("simple Scandinavian pieces, birch wood and white") },
  { id: "hay", level: 2, name: "HAY", aesthetic: ["scandinavian", "colorful"], prompt: look("playful Danish design with soft colours") },
  { id: "muji", level: 2, name: "Muji", aesthetic: ["japandi", "minimalist"], prompt: look("minimal Japanese design, pale wood and plain fabrics") },
  { id: "ferm-living", level: 2, name: "Ferm Living", aesthetic: ["scandinavian", "earthy"], prompt: look("Nordic design in earthy tones and natural textures") },
  { id: "restoration-hardware", level: 4, name: "Restoration Hardware", aesthetic: ["luxurious", "traditional"], prompt: look("grand oversized luxury, reclaimed wood and linen") },
  { id: "anthropologie", level: 3, name: "Anthropologie", aesthetic: ["bohemian", "eclectic"], prompt: look("bohemian eclectic pieces, pattern, rattan and colour") },
  { id: "urban-outfitters", level: 1, makes: ["rug", "lighting", "mirror", "bed", "shelving", "armchair"], name: "Urban Outfitters Home", aesthetic: ["bohemian", "playful"], prompt: look("young bohemian decor, tapestries and plants") },
  { id: "serena-lily", level: 3, name: "Serena & Lily", aesthetic: ["coastal", "airy"], prompt: look("breezy coastal design, white, blue and rattan") },
  { id: "jungalow", level: 2, makes: ["rug", "lighting", "mirror", "planter"], name: "Jungalow", aesthetic: ["bohemian", "botanical"], prompt: look("joyful bohemian style with plants and bold prints") },
  { id: "one-kings-lane", level: 3, name: "One Kings Lane", aesthetic: ["traditional", "elegant"], prompt: look("elegant traditional pieces and antiques") },
  { id: "jonathan-adler", level: 4, name: "Jonathan Adler", aesthetic: ["maximalist", "old_hollywood"], prompt: look("glamorous maximalist pop design, brass and lacquer") },
  { id: "kelly-wearstler", level: 4, name: "Kelly Wearstler", aesthetic: ["art_deco", "luxurious"], prompt: look("sculptural art deco luxury, marble and brass") },
  { id: "design-within-reach", level: 4, name: "Design Within Reach", aesthetic: ["mid_century_modern", "clean_lines"], prompt: look("iconic mid-century modern design classics") },
  { id: "article", level: 2, name: "Article", aesthetic: ["mid_century_modern", "contemporary"], prompt: look("modern mid-century sofas and walnut tables") },
  { id: "rejuvenation", level: 3, makes: ["lighting", "mirror"], name: "Rejuvenation", aesthetic: ["vintage", "brass_accents"], prompt: look("vintage lighting and brass hardware") },
  { id: "cost-plus", level: 1, name: "Cost Plus World Market", aesthetic: ["eclectic", "earthy"], prompt: look("global eclectic decor, carved wood and textiles") },
  { id: "zara-home", level: 2, makes: ["rug", "lighting", "mirror"], name: "Zara Home", aesthetic: ["minimalist", "natural_materials"], prompt: look("calm minimal decor, linen, ceramics and neutral tones") },
  { id: "hm-home", level: 1, makes: ["rug", "lighting", "mirror", "planter"], name: "H&M Home", aesthetic: ["scandinavian", "cozy"], prompt: look("affordable cozy Scandinavian textiles and decor") },
  { id: "fabindia", level: 2, name: "Fabindia", aesthetic: ["earthy", "natural_materials"], prompt: look("handcrafted Indian textiles, block prints and sheesham wood") },
  { id: "good-earth", level: 4, name: "Good Earth", aesthetic: ["luxurious", "traditional"], prompt: look("luxurious Indian craft, hand-painted ceramics and silk") },
  { id: "pepperfry", level: 2, name: "Pepperfry", aesthetic: ["contemporary", "dark_wood"], prompt: look("contemporary furniture in sheesham and teak wood") },
  { id: "urban-ladder", level: 2, name: "Urban Ladder", aesthetic: ["contemporary", "clean_lines"], prompt: look("modern solid wood furniture with clean lines") },
  { id: "the-conran-shop", level: 4, name: "The Conran Shop", aesthetic: ["contemporary", "elegant"], prompt: look("refined modern design and sculptural lighting") },
  { id: "menu", level: 4, name: "Audo Copenhagen", aesthetic: ["japandi", "minimalist"], prompt: look("quiet Nordic minimalism, oak, stone and soft curves") },
  { id: "arhaus", level: 4, name: "Arhaus", aesthetic: ["rustic", "natural_materials"], prompt: look("artisan rustic pieces, reclaimed wood and stone") },
  { id: "lulu-georgia", level: 3, name: "Lulu and Georgia", aesthetic: ["coastal", "earthy"], prompt: look("warm modern pieces, soft neutrals and textured rugs") },
];
