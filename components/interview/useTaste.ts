"use client";

import { useEffect, useRef, useState } from "react";
import type { TasteView } from "@/lib/interview/view";
import type { TastePick } from "@/lib/interview/script";
import type { TasteSignal } from "@/lib/project/store";
import type { Profile } from "@/lib/taste/types";
import { asPrompt } from "@/lib/taste/engine";

// The live taste for the interview, read on the person's own device: each name they love becomes a short design
// description (Gemini, on the server), each description and photo becomes a CLIP vector in the browser, and the taste
// engine turns the vectors into the profile the design reads. Descriptions and vectors are kept, so a new pick only
// reads what's new.

export type TasteResult = { view: TasteView; signals: TasteSignal[]; profile: Profile };
type Read = { name: string; layer: 1 | 2 | 3; vector: number[]; type: string };

const KIND_TYPE = { 1: "place", 2: "brand", 3: "culture" } as const;

export function useTaste(picks: TastePick[], photos: File[]) {
  const [result, setResult] = useState<TasteResult | null>(null);
  const [reading, setReading] = useState(false);
  const [failed, setFailed] = useState(false);
  const names = useRef(new Map<string, Read>());
  const images = useRef(new Map<File, number[]>());
  const key = picks.map((p) => p.name).join("|") + "#" + photos.length;

  useEffect(() => {
    if (!picks.length && !photos.length) return setResult(null);
    let live = true;
    setReading(true);
    setFailed(false);
    (async () => {
      const [{ embedImages, embedTexts }, { profileOf }, { styleName }, { cardWords, profileSummary }] = await Promise.all([
        import("@/lib/taste/clip"),
        import("@/lib/taste/profile-client"),
        import("@/lib/taste/name"),
        import("@/lib/interview/logic"),
      ]);
      // names not read yet: describe them, then embed the descriptions
      const fresh = picks.map((p) => p.name).filter((n) => !names.current.has(n));
      if (fresh.length) {
        const res = await fetch("/api/taste/describe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ names: fresh }) });
        if (!res.ok) throw new Error("describe");
        const { items } = (await res.json()) as { items: { name: string; layer: 1 | 2 | 3; description: string }[] };
        const vecs = await embedTexts(items.map((d) => asPrompt(d.description)));
        items.forEach((d, i) => names.current.set(d.name, { name: d.name, layer: d.layer, vector: vecs[i], type: KIND_TYPE[d.layer] }));
      }
      const newPhotos = photos.filter((f) => !images.current.has(f));
      if (newPhotos.length) (await embedImages(newPhotos)).forEach((v, i) => images.current.set(newPhotos[i], v));

      const reads: (Read & { entityId: string })[] = [
        ...photos.map((f, i) => ({ entityId: `photo-${i + 1}`, name: `Photo ${i + 1}`, layer: 1 as const, vector: images.current.get(f)!, type: "photo" })),
        ...picks.flatMap((p) => {
          const r = names.current.get(p.name);
          return r ? [{ ...r, entityId: `name:${p.name.toLowerCase()}` }] : [];
        }),
      ];
      const profile = await profileOf(reads.map((r) => ({ source: { entityId: r.entityId, name: r.name, layer: r.layer }, vector: r.vector })));
      if (!live) return;
      setResult({
        profile,
        signals: reads.map((r) => ({ entityId: r.entityId, name: r.name, layer: r.layer, type: r.type })),
        view: { ...profileSummary(profile, 16, 4), count: reads.length, words: cardWords(profile), family: styleName(profile) },
      });
    })()
      .catch(() => live && setFailed(true))
      .finally(() => live && setReading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { result, reading, failed };
}
