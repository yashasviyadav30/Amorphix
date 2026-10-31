"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { PlanSvg } from "@/components/plan/PlanSvg";
import { Reveal } from "@/components/fx/Motion";
import { tick, transition } from "@/components/fx/sfx";
import { planOptionsFor } from "@/lib/design/options";
import { compare, sayClaim } from "@/lib/design/compare";
import { buildingShell } from "@/lib/layout/footprint";
import { TEMPLATES } from "@/lib/layout/templates";

// The real layout engine, run in the browser on a sample one-storey house: the same three plans and the same honest
// trade-offs a project gets, drawn live rather than shown as pictures.
export function PlansDemo() {
  const still = useReducedMotion();
  const plans = useMemo(() => {
    // a one-storey family house on a wide plot: the three ideas differ most clearly there
    const program = { ...TEMPLATES.house, floors: 1, rooms: TEMPLATES.house.rooms.map((r) => ({ ...r, floor: 0 })) };
    const options = planOptionsFor(program, buildingShell(program, { width: 16, depth: 10 }), { space_type: "house" });
    const claims = compare(options);
    return options.map((layout, i) => ({ layout, ...claims[i] }));
  }, []);
  const [open, setOpen] = useState(0);
  if (!plans.length) return null;
  return (
    <section id="plans" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-8">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">Three plans, one plot</p>
        <h2 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">Every option says what it does best, and what it gives up.</h2>
        <p className="mt-4 text-lg text-ink-soft">These are drawn right now by Amorphix&apos;s layout engine for a sample one-storey family home. Yours are drawn for your plot, your people and your taste.</p>
      </Reveal>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {plans.map((p, i) => {
          const on = i === open;
          return (
            <motion.button
              key={p.layout.concept?.id ?? i}
              type="button"
              onClick={() => (tick(), setOpen(i))}
              aria-pressed={on}
              initial={still ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: 0.1 * i, duration: 0.5 }}
              className={`group rounded-2xl border bg-paper-raised p-4 text-left transition ${on ? "border-accent shadow-[0_18px_44px_-24px_var(--accent)]" : "border-line hover:border-accent/60"}`}
            >
              <div className="rounded-xl border border-line bg-paper p-2">
                <PlanSvg layout={p.layout} units="imperial" className="h-64 w-full" />
              </div>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">Option {i + 1}</p>
              <p className="mt-1 font-serif text-2xl">{p.layout.concept?.name}</p>
              {p.layout.concept?.summary && <p className="mt-1 text-sm text-ink-soft">{p.layout.concept.summary}</p>}
              <ul className="mt-3 space-y-1 text-sm">
                {p.gains.slice(0, 2).map((c) => (
                  <li key={c.measure} className="text-leaf">
                    + {sayClaim(c)}
                  </li>
                ))}
                {p.gives.map((c) => (
                  <li key={c.measure} className="text-amber-700 dark:text-amber-400">
                    − {sayClaim(c)}
                  </li>
                ))}
              </ul>
            </motion.button>
          );
        })}
      </div>
      <div className="mt-10 text-center">
        <Link href="/start" onClick={() => transition()} className="glow-btn inline-block rounded-full px-7 py-3">
          Draw mine
        </Link>
        <p className="mt-3 text-sm text-ink-soft">Free, no account needed to try.</p>
      </div>
    </section>
  );
}
