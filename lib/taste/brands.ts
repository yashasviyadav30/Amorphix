// Home brands Amorphix can furnish from, each with the look it is known for. The description is embedded with the same
// model as photos and style words, so a brand is ranked by how close its look sits to a person's taste.
export type BrandEntry = { id: string; name: string; aesthetic: string[]; prompt: string };

const look = (s: string) => `a photo of furniture and decor with ${s}`;

export const BRANDS: BrandEntry[] = [
  { id: "west-elm", name: "West Elm", aesthetic: ["mid_century_modern", "clean_lines"], prompt: look("mid-century modern lines, walnut wood and brass details") },
  { id: "pottery-barn", name: "Pottery Barn", aesthetic: ["traditional", "cozy"], prompt: look("classic comfortable American style, linen and warm wood") },
  { id: "cb2", name: "CB2", aesthetic: ["contemporary", "sleek"], prompt: look("modern sleek pieces, marble, black metal and bold forms") },
  { id: "crate-and-barrel", name: "Crate & Barrel", aesthetic: ["contemporary", "natural_materials"], prompt: look("relaxed modern design and natural materials") },
  { id: "ikea", name: "IKEA", aesthetic: ["scandinavian", "light_wood"], prompt: look("simple Scandinavian pieces, birch wood and white") },
  { id: "hay", name: "HAY", aesthetic: ["scandinavian", "colorful"], prompt: look("playful Danish design with soft colours") },
  { id: "muji", name: "Muji", aesthetic: ["japandi", "minimalist"], prompt: look("minimal Japanese design, pale wood and plain fabrics") },
  { id: "ferm-living", name: "Ferm Living", aesthetic: ["scandinavian", "earthy"], prompt: look("Nordic design in earthy tones and natural textures") },
  { id: "restoration-hardware", name: "Restoration Hardware", aesthetic: ["luxurious", "traditional"], prompt: look("grand oversized luxury, reclaimed wood and linen") },
  { id: "anthropologie", name: "Anthropologie", aesthetic: ["bohemian", "eclectic"], prompt: look("bohemian eclectic pieces, pattern, rattan and colour") },
  { id: "urban-outfitters", name: "Urban Outfitters Home", aesthetic: ["bohemian", "playful"], prompt: look("young bohemian decor, tapestries and plants") },
  { id: "serena-lily", name: "Serena & Lily", aesthetic: ["coastal", "airy"], prompt: look("breezy coastal design, white, blue and rattan") },
  { id: "jungalow", name: "Jungalow", aesthetic: ["bohemian", "botanical"], prompt: look("joyful bohemian style with plants and bold prints") },
  { id: "one-kings-lane", name: "One Kings Lane", aesthetic: ["traditional", "elegant"], prompt: look("elegant traditional pieces and antiques") },
  { id: "jonathan-adler", name: "Jonathan Adler", aesthetic: ["maximalist", "old_hollywood"], prompt: look("glamorous maximalist pop design, brass and lacquer") },
  { id: "kelly-wearstler", name: "Kelly Wearstler", aesthetic: ["art_deco", "luxurious"], prompt: look("sculptural art deco luxury, marble and brass") },
  { id: "design-within-reach", name: "Design Within Reach", aesthetic: ["mid_century_modern", "clean_lines"], prompt: look("iconic mid-century modern design classics") },
  { id: "article", name: "Article", aesthetic: ["mid_century_modern", "contemporary"], prompt: look("modern mid-century sofas and walnut tables") },
  { id: "rejuvenation", name: "Rejuvenation", aesthetic: ["vintage", "brass_accents"], prompt: look("vintage lighting and brass hardware") },
  { id: "cost-plus", name: "Cost Plus World Market", aesthetic: ["eclectic", "earthy"], prompt: look("global eclectic decor, carved wood and textiles") },
  { id: "zara-home", name: "Zara Home", aesthetic: ["minimalist", "natural_materials"], prompt: look("calm minimal decor, linen, ceramics and neutral tones") },
  { id: "hm-home", name: "H&M Home", aesthetic: ["scandinavian", "cozy"], prompt: look("affordable cozy Scandinavian textiles and decor") },
  { id: "fabindia", name: "Fabindia", aesthetic: ["earthy", "natural_materials"], prompt: look("handcrafted Indian textiles, block prints and sheesham wood") },
  { id: "good-earth", name: "Good Earth", aesthetic: ["luxurious", "traditional"], prompt: look("luxurious Indian craft, hand-painted ceramics and silk") },
  { id: "pepperfry", name: "Pepperfry", aesthetic: ["contemporary", "dark_wood"], prompt: look("contemporary furniture in sheesham and teak wood") },
  { id: "urban-ladder", name: "Urban Ladder", aesthetic: ["contemporary", "clean_lines"], prompt: look("modern solid wood furniture with clean lines") },
  { id: "the-conran-shop", name: "The Conran Shop", aesthetic: ["contemporary", "elegant"], prompt: look("refined modern design and sculptural lighting") },
  { id: "menu", name: "Audo Copenhagen", aesthetic: ["japandi", "minimalist"], prompt: look("quiet Nordic minimalism, oak, stone and soft curves") },
  { id: "arhaus", name: "Arhaus", aesthetic: ["rustic", "natural_materials"], prompt: look("artisan rustic pieces, reclaimed wood and stone") },
  { id: "lulu-georgia", name: "Lulu and Georgia", aesthetic: ["coastal", "earthy"], prompt: look("warm modern pieces, soft neutrals and textured rugs") },
];
