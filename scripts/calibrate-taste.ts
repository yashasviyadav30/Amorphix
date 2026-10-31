// Calibrates the style words and brands for names. Some words (japandi, contemporary) and some brands sit close to
// almost any description of an interior, so on raw similarity they win for everyone. This reads a varied set of loves
// through the same pipeline as the interview (Gemini descriptions, CLIP text vectors) and stores each word's and each
// brand's usual similarity and spread, so a name counts toward one only when it sits above its usual level. The set
// leaves out the names used to check it.
//   node --env-file=.env.local scripts/calibrate-taste.ts
import { readFileSync, writeFileSync } from "node:fs";
import { AutoTokenizer, CLIPTextModelWithProjection } from "@huggingface/transformers";
import { describe, MAX_NAMES } from "../lib/taste/describe.ts";
import { asPrompt, centreOf, cosine, minus } from "../lib/taste/engine.ts";
import { chatModel } from "../lib/models.ts";

const SET = [
  "The Ritz Paris", "Soho House", "Hotel Il Pellicano", "Ace Hotel Kyoto", "Taj Lake Palace", "Six Senses Bhutan",
  "The Standard High Line", "Claridge's", "Noma", "Tartine Bakery", "Starbucks Reserve Roastery", "Rosewood Hong Kong",
  "IKEA", "West Elm", "HAY", "Restoration Hardware", "Anthropologie", "Fabindia", "Good Earth", "Pottery Barn",
  "Ferm Living", "Kelly Wearstler", "Serena & Lily", "Arhaus",
  "In the Mood for Love", "Amélie", "Call Me by Your Name", "Interstellar", "Blade Runner 2049", "The Darjeeling Limited",
  "Mamma Mia!", "Her", "Downton Abbey", "Stranger Things", "Fleabag", "Lost in Translation",
  "Bon Iver", "Frank Sinatra", "Daft Punk", "A. R. Rahman", "Fleetwood Mac", "Nils Frahm",
];
type Vec = { vector: number[] };
const v = JSON.parse(readFileSync("lib/taste/vectors.json", "utf8")) as { model: string; words: (Vec & { value: string })[]; brands: (Vec & { id: string })[] };
const tok = await AutoTokenizer.from_pretrained(v.model);
const model = await CLIPTextModelWithProjection.from_pretrained(v.model, { dtype: "q8" });
const centre = centreOf(v.brands.map((b) => b.vector));

const wordSims: number[][] = v.words.map(() => []);
const brandSims: number[][] = v.brands.map(() => []);
for (let i = 0; i < SET.length; i += MAX_NAMES) {
  const items = await describe(SET.slice(i, i + MAX_NAMES), chatModel());
  const { text_embeds } = await model(tok(items.map((d) => asPrompt(d.description)), { padding: true, truncation: true }));
  for (const q of text_embeds.tolist() as number[][]) {
    v.words.forEach((w, k) => wordSims[k].push(cosine(q, w.vector)));
    v.brands.forEach((b, k) => brandSims[k].push(cosine(minus(q, centre), minus(b.vector, centre))));
  }
  console.log(`read ${Math.min(i + MAX_NAMES, SET.length)} of ${SET.length}`);
}
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const stats = (s: number[]) => {
  const mu = s.reduce((a, x) => a + x, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, x) => a + (x - mu) ** 2, 0) / s.length) || 1;
  return { mu: r4(mu), sd: r4(sd) };
};
const words = v.words.map((w, k) => ({ value: w.value, ...stats(wordSims[k]) }));
const brands = v.brands.map((b, k) => ({ id: b.id, ...stats(brandSims[k]) }));
writeFileSync("lib/taste/calibration.json", JSON.stringify({ model: v.model, n: SET.length, words, brands }) + "\n");
console.log("wrote", words.length, "words and", brands.length, "brands from", SET.length, "loves");
