// Embeds the style vocabulary and the brand catalog with CLIP's text encoder and writes lib/taste/vectors.json, so
// the app can match a person's photo and word vectors against them without loading a model on the server.
//   node scripts/embed-taste.ts
import { writeFileSync } from "node:fs";
import { AutoTokenizer, CLIPTextModelWithProjection } from "@huggingface/transformers";
import { VOCAB } from "../lib/taste/vocab.ts";
import { BRANDS } from "../lib/taste/brands.ts";

export const MODEL = "Xenova/clip-vit-base-patch32";

const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
const model = await CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: "q8" });

async function embed(texts: string[]) {
  const inputs = tokenizer(texts, { padding: true, truncation: true });
  const { text_embeds } = await model(inputs);
  const rows = text_embeds.tolist() as number[][];
  // unit length, rounded, so the file stays small and cosine is a dot product
  return rows.map((r) => {
    const n = Math.hypot(...r) || 1;
    return r.map((x) => Math.round((x / n) * 1e4) / 1e4);
  });
}

const words = await embed(VOCAB.map((w) => w.prompt));
const brands = await embed(BRANDS.map((b) => b.prompt));
writeFileSync(
  "lib/taste/vectors.json",
  JSON.stringify({
    model: MODEL,
    words: VOCAB.map((w, i) => ({ family: w.family, value: w.value, vector: words[i] })),
    brands: BRANDS.map((b, i) => ({ id: b.id, name: b.name, aesthetic: b.aesthetic, vector: brands[i] })),
  }),
);
console.log("words", words.length, "brands", brands.length, "dims", words[0].length);
