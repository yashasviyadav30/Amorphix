"use client";

import { sayArea } from "@/lib/export/drawings";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HudCard, Reveal, Ring, Scanning } from "@/components/fx/Motion";
import { ok, tick } from "@/components/fx/sfx";
import type { Layout, Shell } from "@/lib/layout/schema";
import type { Brief } from "@/lib/design/brief";
import type { Profile } from "@/lib/qloo/taste";
import type { Tier } from "@/lib/budget/costs";
import { timeline } from "@/lib/budget/timeline";
import { addAll, choicesOf, fixes, scoreWith, type Ticked } from "@/lib/green/improve";
import type { EcoBrand, Nursery } from "@/lib/green/eco";
import { look } from "@/lib/three/materials";

type Props = {
  id: string;
  layout: Layout;
  brief: Brief | null;
  taste: Profile | null;
  lot: Shell | null;
  tier: Tier;
  newBuild: boolean;
  said: string[];
  /** Greenery changes ticked so far, and where to report a new list (the 3D reads it). */
  ticked: Ticked;
  onTicked: (t: Ticked) => void;
  units: "imperial" | "metric";
};

/** A Google Maps search for a place: opens the map on any device, no key needed. */
export const mapsLink = (name: string, address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address].filter(Boolean).join(", "))}`;

// How long it takes, and how green it is: a phase chart, then the greenery score with one tip per room, the eco
// brands in their taste and plant nurseries near the site.
export function GreenAndTime({ id, layout, brief, taste, lot, tier, newBuild, said, ticked, onTicked, units }: Props) {
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const still = useReducedMotion();
  const [showDone, setShowDone] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [eco, setEco] = useState<{ brands: EcoBrand[]; nurseries: Nursery[] } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/projects/${id}/green`)
      .then((r) => (r.ok ? r.json() : { brands: [], nurseries: [] }))
      .then((b) => live && setEco(b))
      .catch(() => live && setEco({ brands: [], nurseries: [] }));
    return () => {
      live = false;
    };
  }, [id]);

  const t = useMemo(() => timeline(layout, tier, newBuild), [layout, tier, newBuild]);
  // The same furniture the 3D shows (with any plants they added), so the plants counted are the plants you see.
  const input = useMemo(() => ({ layout, briefPlants: brief?.plants ?? [], lot, lush: look(brief, taste).lush }), [layout, brief, taste, lot]);
  const g = useMemo(() => scoreWith(input, choicesOf(ticked)), [input, ticked]);
  const open = useMemo(() => fixes(input, ticked), [input, ticked]);
  const save = (next: Ticked) => {
    if (next.length > ticked.length) ok();
    else tick();
    onTicked(next);
    setSaving("saving");
    fetch(`/api/projects/${id}/green`, { method: "POST", body: JSON.stringify({ ticked: next }) })
      .then((r) => setSaving(r.ok ? "saved" : "failed"))
      .catch(() => setSaving("failed"));
  };
  const months = Math.round((t.weeks / 4.35) * 2) / 2;

  return (
    <>
      <HudCard className="mt-8 p-5">
      <section aria-labelledby="timeline">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="timeline" className="font-serif text-2xl">Timeline</h2>
          <p className="text-sm text-ink-soft">
            About {t.weeks} weeks ({months} months) from design to handover
          </p>
        </div>
        {said.length > 0 && <p className="mt-1 text-sm text-ink-soft">You told us: {said.join(", ")}.</p>}
        <ol className="mt-4 space-y-2">
          {t.phases.map((ph) => (
            <li key={ph.id} className="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 text-sm">
              <span title={ph.note}>{ph.name}</span>
              <div className="relative h-6 rounded-full bg-line/50" aria-label={`Week ${ph.start + 1} to ${ph.start + ph.weeks}`}>
                <motion.div
                  className="absolute top-0 h-6 origin-left rounded-full bg-gradient-to-r from-btn to-accent px-2 text-xs leading-6 text-btn-ink"
                  style={{ left: `${(ph.start / t.weeks) * 100}%` }}
                  initial={still ? false : { width: 0, opacity: 0 }}
                  whileInView={{ width: `${(ph.weeks / t.weeks) * 100}%`, opacity: 1 }}
                  animate={{ width: `${(ph.weeks / t.weeks) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.1 + t.phases.indexOf(ph) * 0.09, ease: [0.16, 1, 0.3, 1] }}
                >
                  {ph.weeks}w
                </motion.div>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-ink-soft">Typical durations for this size and quality. Permits and deliveries vary most.</p>
      </section>
      </HudCard>

      <HudCard className="mt-8 p-5" delay={0.05}>
      <section aria-labelledby="green">
        <div className="flex flex-wrap items-center gap-4">
          <Ring value={g.score} />
          <div>
            <h2 id="green" className="font-serif text-2xl">Greenery: {g.score} out of 100</h2>
            <p className="text-sm text-ink-soft">
              Plants per room, how well they suit each room&apos;s light, how many kinds, and how easy they are to keep
              {g.garden ? `, plus ${sayArea(g.garden.area, units)} of garden` : ""}.
            </p>
            {g.species.length > 0 && <p className="mt-1 text-sm">Your plants: {g.species.join(", ")}.</p>}
          </div>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {g.rooms.map((r, i) => (
            <motion.li
              key={`${r.id}-${i}`}
              className="rounded-xl border border-line p-3 text-sm transition-colors hover:border-leaf/60"
              initial={still ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium">{r.name}</span>
                <span className="tabular-nums text-leaf">{r.score}</span>
              </div>
              <p className="text-ink-soft">
                {r.light} light · {r.plants} plant{r.plants === 1 ? "" : "s"}
                {r.pick ? ` · ${r.pick.name.toLowerCase()}` : ""}
              </p>
              {r.tip && <p className="mt-1">{r.tip}</p>}
            </motion.li>
          ))}
        </ul>

        {(open.length > 0 || ticked.length > 0) && (
          <div className="mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-serif text-xl">Ways to raise your score</h3>
              <p className="text-xs text-ink-soft" aria-live="polite">
                {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved: the walkthrough shows these plants" : saving === "failed" ? "Couldn't save. Try again." : "Tick a change to add it to your design."}
              </p>
            </div>
            {ticked.length > 0 && (
              <div className="mt-2 rounded-xl border border-leaf/40 bg-leaf/5 text-sm">
                <div className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <span className="text-leaf">✓</span>
                  <span className="flex-1">
                    {ticked.length} change{ticked.length === 1 ? "" : "s"} added to your design
                  </span>
                  <button type="button" onClick={() => setShowDone((v) => !v)} className="text-xs text-ink-soft underline-offset-2 hover:underline" aria-expanded={showDone}>
                    {showDone ? "Hide" : "Show"}
                  </button>
                  <button type="button" onClick={() => save([])} className="text-xs text-ink-soft underline-offset-2 hover:underline">
                    Undo all
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {showDone && (
                    <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-leaf/30">
                      {ticked.map((f) => (
                        <li key={f.id}>
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-leaf/10">
                            <input type="checkbox" checked onChange={() => save(ticked.filter((x) => x.id !== f.id))} className="h-4 w-4 accent-[var(--leaf)]" />
                            <span className="flex-1">{f.label}</span>
                          </label>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            )}
            {open.length > 0 && (
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line text-sm">
                <AnimatePresence initial={false}>
                  {(showAll ? open : open.slice(0, 3)).map((f) => (
                    <motion.li key={f.id} layout={!still} initial={still ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-leaf/5">
                        <input type="checkbox" checked={false} onChange={() => save([...ticked, { id: f.id, label: f.label, change: f.change }])} className="h-4 w-4 accent-[var(--leaf)]" />
                        <span className="flex-1">{f.label}</span>
                        <span className="tabular-nums text-leaf">+{f.gain >= 1 ? Math.round(f.gain) : "<1"}</span>
                      </label>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
            {open.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <motion.button
                  type="button"
                  whileTap={still ? undefined : { scale: 0.95 }}
                  onClick={() => save(addAll(input, ticked))}
                  className="rounded-full bg-leaf px-4 py-1.5 text-sm text-paper transition hover:opacity-90"
                >
                  Add all
                </motion.button>
                {open.length > 3 && (
                  <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm text-ink-soft underline-offset-2 hover:underline" aria-expanded={showAll}>
                    {showAll ? "Show fewer" : `Show ${open.length - 3} more`}
                  </button>
                )}
              </div>
            )}
            {!open.length && g.score < 100 && <p className="mt-2 text-xs text-ink-soft">That&apos;s all this plan has room for: the rest would need more floor or window space.</p>}
          </div>
        )}

        {!eco && (
          <div className="mt-6">
            <Scanning label="Finding eco brands in your taste and nurseries near you" />
          </div>
        )}
        {eco && (eco.brands.length > 0 || eco.nurseries.length > 0) && (
          <Reveal className="mt-6 grid gap-6 md:grid-cols-2">
            {eco.brands.length > 0 && (
              <div>
                <h3 className="font-serif text-xl">Brands in your taste that care</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {eco.brands.slice(0, 5).map((b) => (
                    <li key={b.name}>
                      <span className="font-medium">{b.name}</span>
                      <span className="text-ink-soft">{b.loved ? " · you love it" : b.via.length ? ` · matched to ${b.via.slice(0, 2).join(" and ")}` : ""}</span>
                      <p className="text-ink-soft">{b.does.join(", ")}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {eco.nurseries.length > 0 && (
              <div>
                <h3 className="font-serif text-xl">Plant nurseries near you</h3>
                <p className="text-xs text-ink-soft">Ranked for your taste.</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {eco.nurseries.map((n) => (
                    <li key={n.name}>
                      <a href={mapsLink(n.name, n.address)} target="_blank" rel="noopener noreferrer" className="group block rounded-lg p-1 -m-1 hover:bg-paper">
                        <span className="font-medium group-hover:underline">{n.name}</span>
                        {n.address && <p className="text-ink-soft">{n.address}</p>}
                        <span className="text-xs text-leaf">Open in Google Maps ↗</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Reveal>
        )}
      </section>
      </HudCard>
    </>
  );
}
