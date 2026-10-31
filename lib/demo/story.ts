import type { Answers, TastePick } from "../interview/script.ts";

// The judges' demo: one Los Angeles studio and the people around it, and the interview answers that made each
// project. scripts/demo-world.ts builds the world from these through the real app; the interview replays Maya's.
// Synthetic people only. Each taste pick is a name, read by Amorphix's taste model like anyone's.

export const DEMO_EMAIL = (role: DemoRole) => `amorphix.demo.${role}@example.com`;
export const DEMO_ROLES = ["maya", "lena", "mike", "sam"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export const PEOPLE: Record<DemoRole, { role: "owner" | "architect" | "builder"; name: string; company: string | null; city: string; label: string }> = {
  maya: { role: "owner", name: "Maya Reyes", company: null, city: "Los Angeles, CA", label: "Homeowner" },
  lena: { role: "architect", name: "Lena Ortiz", company: "Ortiz Studio", city: "Los Angeles, CA", label: "Architect" },
  mike: { role: "builder", name: "Mike Dawson", company: "Dawson Build Co.", city: "Los Angeles, CA", label: "Builder" },
  sam: { role: "owner", name: "Sam Okafor", company: null, city: "Brooklyn, NY", label: "Café owner" },
};

const pick = (slot: TastePick["slot"], name: string): TastePick => ({ slot, id: `name:${name.toLowerCase()}`, name });

/** Maya's house in Silver Lake: the story the judges follow, from the interview to the building site. */
export const MAYA: Answers = {
  type: "house",
  build: "new",
  size: { width: 45, depth: 70, unit: "ft" },
  floors: "2",
  city: "Los Angeles, CA",
  who: ["me", "partner", "kids"],
  kids: ["3", "8"],
  wfh: "yes",
  bedrooms: "3",
  extras: ["office", "guest"],
  kitchen: "open",
  entertaining: "often",
  bedroomsPlace: "apart",
  workVisitors: "no",
  outlook: "garden",
  dislikes: "Our kitchen is dark and closed off, so I can't see the kids while I cook",
  budget: "premium",
  place: pick("place", "Chateau Marmont"),
  brand: pick("brand", "West Elm"),
  media: pick("media", "Mad Men"),
};

/** The Parks' single-floor house in Pasadena, with Lena, waiting for their approval. */
export const PARKS: Answers = {
  type: "house",
  build: "new",
  size: { width: 60, depth: 80, unit: "ft" },
  floors: "1",
  city: "Pasadena, CA",
  who: ["me", "partner", "elders"],
  wfh: "no",
  bedrooms: "4",
  extras: ["guest"],
  kitchen: "semi",
  entertaining: "sometimes",
  bedroomsPlace: "apart",
  outlook: "garden",
  dislikes: "",
  budget: "luxury",
  place: pick("place", "Parker Palm Springs"),
  brand: pick("brand", "Design Within Reach"),
  media: pick("media", "The Grand Budapest Hotel"),
};

/** Ana's apartment in Santa Monica, with Lena and Mike: in its last week, snags and the handover. */
export const ANA: Answers = {
  type: "apartment",
  build: "reno",
  size: { width: 32, depth: 40, unit: "ft" },
  city: "Santa Monica, CA",
  who: ["me", "pets"],
  wfh: "yes",
  bedrooms: "1",
  extras: ["office"],
  kitchen: "open",
  entertaining: "rarely",
  workVisitors: "no",
  outlook: "either",
  dislikes: "",
  budget: "mid",
  place: pick("place", "Aman Tokyo"),
  brand: pick("brand", "Muji"),
  media: pick("media", "Spirited Away"),
};

/** Sam's café in Brooklyn, designed by Sam alone. */
export const SAM: Answers = {
  type: "cafe",
  build: "reno",
  size: { width: 25, depth: 60, unit: "ft" },
  city: "Brooklyn, NY",
  guests: ["locals", "professionals"],
  service: "both",
  cafeKitchen: "prep",
  seats: "24",
  outdoor: "yes",
  budget: "mid",
  place: pick("place", "Blue Bottle Coffee"),
  brand: pick("brand", "Muji"),
  media: pick("media", "Norah Jones"),
};

export const TITLES = { maya: "Maya's house", parks: "The Parks' house", ana: "Ana's apartment", sam: "The Brooklyn café" } as const;
