"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Layout } from "@/lib/layout/schema";
import { ok, tick, whoosh } from "@/components/fx/sfx";

// Small interactive parts of the project in focus on the home page.

const HouseScene = dynamic(() => import("@/components/three/HouseScene"), {
  ssr: false,
  loading: () => <p className="grid h-full place-items-center font-mono text-xs text-ink-soft">&gt; building the 3D model…</p>,
});

/** The plan drawing, with "View in 3D" that loads the model in its place only when asked (heavy on a phone). */
export function PlanOr3D({ projectId, layout, children }: { projectId: string; layout: Layout | null; children: React.ReactNode }) {
  const [look, setLook] = useState<{ brief?: unknown; taste?: unknown } | null>(null);
  const [busy, setBusy] = useState(false);
  const open3d = async () => {
    whoosh();
    setBusy(true);
    // the colours and furniture come from the project's brief and taste
    const p: { brief?: unknown; taste?: unknown } = await fetch(`/api/projects/${projectId}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    setLook({ brief: p.brief, taste: p.taste });
    setBusy(false);
  };
  return (
    <div className="relative h-full min-h-[16rem]">
      <AnimatePresence mode="wait">
        {look && layout ? (
          <motion.div key="3d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 overflow-hidden rounded-2xl">
            <HouseScene layout={layout} brief={look.brief as never} taste={look.taste as never} mode="orbit" autoRotate playing={false} />
          </motion.div>
        ) : (
          <motion.div key="plan" exit={{ opacity: 0 }} className="absolute inset-0">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
      {layout && (
        <button
          type="button"
          onClick={() => (look ? (tick(), setLook(null)) : void open3d())}
          className="absolute bottom-3 right-3 z-10 rounded-full border border-line bg-paper-raised/90 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider backdrop-blur transition hover:border-accent hover:text-accent"
        >
          {busy ? "Loading the 3D…" : look ? "Back to plan" : "View in 3D"}
        </button>
      )}
    </div>
  );
}

/** A business's opening day: worked out from the design's timeline, and theirs to set. */
export function OpeningDay({ projectId, date, set, canEdit }: { projectId: string; date: string | null; set: boolean; canEdit: boolean }) {
  const [value, setValue] = useState(date);
  const [editing, setEditing] = useState(false);
  // today, read once: the count doesn't need to tick while the page is open
  const [now] = useState(() => Date.now());
  const days = value ? Math.ceil((new Date(value).getTime() - now) / 86_400_000) : null;
  async function save(v: string) {
    setValue(v);
    setEditing(false);
    const res = await fetch(`/api/projects/${projectId}/opening`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date: v }) }).catch(() => null);
    if (res?.ok) ok();
  }
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">Opening day</p>
      {editing ? (
        <input type="date" defaultValue={value ?? undefined} autoFocus onBlur={(e) => e.target.value && void save(e.target.value)} onChange={(e) => e.target.value && void save(e.target.value)} className="mt-1 rounded-lg border border-line bg-paper px-2 py-1 text-sm" />
      ) : (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="whitespace-nowrap font-serif text-3xl">{days === null ? "—" : days > 0 ? `${days} days` : "Open"}</span>
          {value && <span className="text-sm text-ink-soft">{new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{set ? "" : ", estimated"}</span>}
          {canEdit && (
            <button type="button" onClick={() => (tick(), setEditing(true))} className="text-xs text-accent hover:underline">
              change
            </button>
          )}
        </p>
      )}
    </div>
  );
}
