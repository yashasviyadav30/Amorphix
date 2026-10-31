// The taste profile the whole app reads: style words with their weight and where each came from, and the home brands
// that match. Amorphix's taste engine builds it from the photos and words a person loves.

// Where a signal came from, strongest first: 1 a photo or a place they love, 2 a brand, 3 a film, show or music.
export type Layer = 1 | 2 | 3;
export type Family = "decor" | "ambience" | "aesthetic" | "tone" | "style";
export type Evidence = { entityId: string; name: string; layer: Layer };
export type StyleTag = { family: Family; value: string; weight: number; sources: Evidence[] };
export type Brand = { id: string; name: string; affinity: number; aesthetic: string[]; because: { entityId: string; score: number }[] };
export type Profile = { tags: StyleTag[]; brands: Brand[] };
