"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ok, tick } from "@/components/fx/sfx";

type Request = { id: number; project_id: string; role: "architect" | "builder"; message: string | null; created_at: string; title: string | null; location: string | null; from: string };

// Clients asking this pro to join their project: look at the design first, then say yes (join) or no.
export function Requests() {
  const [list, setList] = useState<Request[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pros/requests")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => setList(b?.requests ?? []))
      .catch(() => setList([]));
  }, []);

  async function answer(r: Request, accept: boolean) {
    tick();
    setBusy(r.id);
    setError(null);
    const res = await fetch(`/api/pros/requests/${r.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accept }) });
    setBusy(null);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "That didn't go through.");
    if (accept) {
      ok();
      return window.location.assign(`/project/${r.project_id}`);
    }
    setList((l) => l?.filter((x) => x.id !== r.id) ?? null);
  }

  if (!list?.length) return null;
  return (
    <section className="mt-6 rounded-2xl border border-accent/40 bg-accent/5 p-4">
      <p className="text-sm font-medium">
        New client requests <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-xs text-white">{list.length}</span>
      </p>
      <ul className="mt-3 space-y-2">
        <AnimatePresence>
          {list.map((r) => (
            <motion.li key={r.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }} className="rounded-xl border border-line bg-paper-raised p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {r.from} · {r.title ?? "A project"}
                    {r.location && <span className="text-ink-soft"> · {r.location}</span>}
                  </p>
                  <p className="text-sm text-ink-soft">Wants you as the {r.role}.</p>
                  {r.message && <p className="mt-1 text-sm">&ldquo;{r.message}&rdquo;</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={`/project/${r.project_id}`} onClick={() => tick()} className="rounded-full border border-line px-4 py-1.5 text-sm transition hover:border-accent hover:text-accent">
                    View design
                  </a>
                  <button onClick={() => answer(r, true)} disabled={busy === r.id} className="glow-btn rounded-full px-4 py-1.5 text-sm disabled:opacity-60">
                    Accept
                  </button>
                  <button onClick={() => answer(r, false)} disabled={busy === r.id} className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:text-ink disabled:opacity-60">
                    Decline
                  </button>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
