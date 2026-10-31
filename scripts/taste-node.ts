// The interview's taste reading, run in Node for scripts: names become design descriptions (Gemini), descriptions
// become CLIP text vectors, and the taste engine turns them into a profile with YugabyteDB's vector search, exactly
// as /api/taste/profile does (in memory when there is no database).
import { readFileSync } from "node:fs";
import { AutoTokenizer, CLIPTextModelWithProjection } from "@huggingface/transformers";
import { describe } from "../lib/taste/describe.ts";
import { asPrompt, buildProfile, profileFrom, type Signal } from "../lib/taste/engine.ts";
import { simsFromYb, yb } from "../lib/taste/yb.ts";
import { chatModel } from "../lib/models.ts";
import type { TasteSignal } from "../lib/project/store.ts";
import type { Profile } from "../lib/taste/types.ts";

const vectors = JSON.parse(readFileSync(new URL("../lib/taste/vectors.json", import.meta.url), "utf8"));
const calibration = JSON.parse(readFileSync(new URL("../lib/taste/calibration.json", import.meta.url), "utf8"));
const KIND_TYPE = { 1: "place", 2: "brand", 3: "culture" } as const;

async function profileOf(signals: Signal[]): Promise<Profile> {
  const sql = yb();
  if (!sql) return buildProfile(signals, vectors.words, vectors.brands, 12, calibration);
  const { words, sims } = await simsFromYb(sql, signals, vectors.brands.length);
  return profileFrom(signals, words, sims, calibration, 12);
}

export async function tasteFor(names: string[]): Promise<{ signals: TasteSignal[]; taste: Profile }> {
  const tokenizer = await AutoTokenizer.from_pretrained(vectors.model);
  const model = await CLIPTextModelWithProjection.from_pretrained(vectors.model, { dtype: "q8" });
  const items = await describe(names, chatModel());
  const { text_embeds } = await model(tokenizer(items.map((d) => asPrompt(d.description)), { padding: true, truncation: true }));
  const rows = (text_embeds.tolist() as number[][]).map((r) => {
    const n = Math.hypot(...r) || 1;
    return r.map((x) => x / n);
  });
  const signals = items.map((d) => ({ entityId: `name:${d.name.toLowerCase()}`, name: d.name, layer: d.layer, type: KIND_TYPE[d.layer] }));
  const taste = await profileOf(signals.map((s, i) => ({ source: { entityId: s.entityId, name: s.name, layer: s.layer }, vector: rows[i] })));
  return { signals, taste };
}
