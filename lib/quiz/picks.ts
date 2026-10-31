// The taste quiz: three rounds of pictures, one tap each. Only names live here; Amorphix finds each one (and its photo)
// at runtime through the cached search, so no Amorphix data is kept in the repo. A fixed list keeps a public page from
// spending the Amorphix quota on anything typed in, and every result is cached after the first time.

export type Slot = "place" | "brand" | "media";

/** Where "Design your space" leaves the three picks for the interview to start with. */
export const QUIZ_KEY = "amorphix-quiz";

export const ROUNDS: { slot: Slot; types: string; ask: string; names: string[] }[] = [
  {
    slot: "place",
    types: "urn:entity:place",
    ask: "Where would you happily spend a whole afternoon?",
    // famous places, each a clear look: industrial, old Hollywood, mid-century colour, modern glass, Japanese calm,
    // Scandinavian home, minimal café, London classic
    names: ["Ace Hotel New York", "Chateau Marmont", "Parker Palm Springs", "The Standard High Line", "Aman Tokyo", "Ett Hem", "Blue Bottle Coffee", "Chiltern Firehouse"],
  },
  {
    slot: "brand",
    types: "urn:entity:brand",
    ask: "Which brand would you fill your home with?",
    // home brands people know, from Scandinavian and minimal to mid-century, classic, modern and boho
    names: ["IKEA", "West Elm", "Pottery Barn", "Crate & Barrel", "CB2", "Design Within Reach", "Anthropologie", "Muji"],
  },
  {
    slot: "media",
    types: "urn:entity:movie,urn:entity:tv_show,urn:entity:artist",
    ask: "What could you watch or play again and again?",
    // films, shows and music with a strong look or mood
    names: ["Mad Men", "The Grand Budapest Hotel", "Interstellar", "Amélie", "Call Me by Your Name", "Spirited Away", "Norah Jones", "Daft Punk"],
  },
];

/** A short, link-safe key for a name: "The Grand Budapest Hotel" becomes "the-grand-budapest-hotel". */
export const keyOf = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The picks in a shared link ("?p=key.key.key"), one per round, or null if any isn't on the list. */
export function parsePicks(p: string | null | undefined): Record<Slot, string> | null {
  const keys = (p ?? "").split(".");
  if (keys.length !== ROUNDS.length) return null;
  const out = {} as Record<Slot, string>;
  for (const [i, r] of ROUNDS.entries()) {
    const name = r.names.find((n) => keyOf(n) === keys[i]);
    if (!name) return null;
    out[r.slot] = name;
  }
  return out;
}

export const linkOf = (picks: Record<Slot, string>) => ROUNDS.map((r) => keyOf(picks[r.slot])).join(".");

const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) ?? [];

/** Whether Amorphix found the right thing: the first word of the name matches ("Hoxton Hotel" finding "HOTEL HOXTON PRIDE" doesn't). */
export function sameName(asked: string, found: string) {
  const a = words(asked).filter((w) => w !== "the");
  const f = words(found).filter((w) => w !== "the");
  return !!a.length && !!f.length && (a[0] === f[0] || a.join("") === f.join(""));
}

export const STYLE_NAME = { midcentury: "Mid-century", industrial: "Industrial", scandi: "Scandinavian", boho: "Boho", classic: "Classic", modern: "Modern" } as const;
