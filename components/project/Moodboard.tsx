"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Tile } from "@/lib/design/moodboard";

// Photos of what they love, the brands matched to it, and places that share their look, each with its reason.
export function Moodboard({ id }: { id: string }) {
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const still = useReducedMotion();

  useEffect(() => {
    let live = true;
    fetch(`/api/projects/${id}/moodboard`)
      .then((r) => (r.ok ? r.json() : { tiles: [] }))
      .then((b: { tiles?: Tile[] }) => live && setTiles(b.tiles ?? []))
      .catch(() => live && setTiles([]));
    return () => {
      live = false;
    };
  }, [id]);

  const shown = (tiles ?? []).filter((t) => !broken.has(t.id));
  if (tiles && !shown.length) return null;
  return (
    <section className="mt-12" aria-labelledby="moodboard" aria-busy={!tiles}>
      <h2 id="moodboard" className="font-serif text-3xl">Your moodboard</h2>
      <p className="mt-1 text-sm text-ink-soft">What you love, the brands that match it, and places that share your look.</p>
      <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {!tiles &&
          Array.from({ length: 4 }, (_, i) => <li key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-paper-raised" />)}
        {shown.map((t, i) => (
          <motion.li
            key={t.id}
            className="group overflow-hidden rounded-2xl border border-line bg-paper-raised transition-shadow hover:shadow-[0_18px_44px_-22px_var(--accent)]"
            initial={still ? false : { opacity: 0, y: 20, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.55, delay: (i % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Qloo's own image host, sized by CSS */}
            <img
              src={t.image}
              alt={t.name}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              onError={() => setBroken((b) => new Set(b).add(t.id))}
            />
            <div className="p-3 text-sm">
              <p className="font-medium">{t.name}</p>
              <p className={t.kind === "loved" ? "text-ink" : "text-ink-soft"}>{t.caption}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
