import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import type { Layer } from "./types.ts";

// The names someone loves (a hotel, a brand, a film) become short design descriptions, because the taste model reads
// a description far better than a bare name: "Muji" alone matches generic words, "minimal Japanese design, pale oak,
// plain linen" matches the right ones. The model also says what kind of thing each name is, which sets its weight.

export type Kind = "place" | "brand" | "culture";
export type Described = { name: string; kind: Kind; layer: Layer; description: string };

const LAYER: Record<Kind, Layer> = { place: 1, brand: 2, culture: 3 };
export const MAX_NAMES = 6;

const Answer = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(["place", "brand", "culture"]),
      description: z.string(),
    }),
  ),
});

// Trim, drop empties and repeats (case-insensitive), cap length and count.
export function cleanNames(names: unknown): string[] {
  if (!Array.isArray(names)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    if (typeof n !== "string") continue;
    const s = n.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out.slice(0, MAX_NAMES);
}

export function describePrompt(names: string[]) {
  return [
    "Someone is designing a home or a space, and these are things they love:",
    ...names.map((n) => `- ${n}`),
    "",
    "For each one, in the same order:",
    '- kind: "place" for a hotel, café, restaurant, shop, house or city; "brand" for a furniture, fashion or lifestyle brand; "culture" for a film, show, book, artist or music.',
    "- description: 12 to 24 words describing the interior look it evokes, as a designer would: style, materials, colours, light and furniture. Concrete words only, no praise, no sentences about the person.",
    "If you don't know a name, describe the look its words suggest.",
  ].join("\n");
}

// Keep only answers for names that were asked, in their order; fill anything missing with the name itself.
export function matchAnswers(names: string[], items: { name: string; kind: Kind; description: string }[]): Described[] {
  return names.map((name, i) => {
    const hit = items.find((x) => x.name.trim().toLowerCase() === name.toLowerCase()) ?? items[i];
    const kind: Kind = hit?.kind ?? "place";
    const description = (hit?.description ?? "").replace(/\s+/g, " ").trim().slice(0, 240) || name;
    return { name, kind, layer: LAYER[kind], description };
  });
}

export async function describe(namesIn: unknown, model: LanguageModel): Promise<Described[]> {
  const names = cleanNames(namesIn);
  if (!names.length) return [];
  const { output } = await generateText({ model, output: Output.object({ schema: Answer }), prompt: describePrompt(names) });
  return matchAnswers(names, output.items);
}
