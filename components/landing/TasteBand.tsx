"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { tick } from "@/components/fx/sfx";
import reads from "@/lib/content/reads.json";

// A slim band under the hero: two things someone loves, read by Amorphix's taste model into a style, the words behind
// it (each from one of the loves) and the brands nearest it. The reads are real runs of the same pipeline as the
// interview (scripts/landing-reads.ts), shown in turn.

export function TasteBand() {
  const still = useReducedMotion();
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (still || held) return;
    const t = setInterval(() => setI((n) => (n + 1) % reads.length), 5200);
    return () => clearInterval(t);
  }, [still, held]);

  const r = reads[i];
  return (
    <section aria-label="Taste read by Amorphix's taste model" className="relative border-y border-line bg-paper-raised/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-8 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex shrink-0 items-center justify-between gap-4 lg:block lg:w-48">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-leaf" />
            Taste model
          </p>
          <div className="flex gap-1.5 lg:mt-3" role="tablist" aria-label="Examples">
            {reads.map((x, n) => (
              <button
                key={x.space}
                role="tab"
                aria-selected={n === i}
                aria-label={x.space}
                onClick={() => {
                  tick();
                  setHeld(true);
                  setI(n);
                }}
                className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-accent" : "w-1.5 bg-line hover:bg-ink-soft"}`}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[8.5rem] min-w-0 flex-1 sm:min-h-[4.5rem]">
          <AnimatePresence mode="wait">
            <motion.div
              key={r.space}
              initial={still ? false : { opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: 0.35 }}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5"
            >
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="mr-1 text-xs text-ink-soft">{r.space}:</span>
                {r.loves.map((name, n) => (
                  <span key={name} className="flex items-center gap-2">
                    {n > 0 && <span className="text-ink-soft">+</span>}
                    <span className="flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1 pr-3 text-sm">
                      <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-[11px] text-accent">♥</span>
                      <span className="max-w-[10rem] truncate sm:max-w-[13rem]">{name}</span>
                    </span>
                  </span>
                ))}
              </div>

              {/* the model reading them */}
              <div aria-hidden className="relative hidden h-px w-16 shrink-0 overflow-hidden bg-line sm:block">
                {!still && <motion.span className="absolute top-0 h-px w-6 bg-accent shadow-[0_0_8px_var(--accent)]" initial={{ left: "-30%" }} animate={{ left: "110%" }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }} />}
              </div>

              <div className="min-w-0">
                <p className="font-serif text-2xl leading-none">{r.style}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {r.words.map((w, n) => (
                    <motion.li
                      key={w.word}
                      initial={still ? false : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.25 + n * 0.08 }}
                      className="rounded-full border border-accent/30 bg-accent/5 px-2.5 py-0.5 font-mono text-[11px] text-accent"
                    >
                      {w.word}
                      {w.from && <span className="ml-1 text-ink-soft">· {w.from}</span>}
                    </motion.li>
                  ))}
                </ul>
                {r.brands.length > 0 && <p className="mt-1.5 truncate text-xs text-ink-soft">Nearest brands, by vector search on YugabyteDB: {r.brands.join(" · ")}</p>}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
