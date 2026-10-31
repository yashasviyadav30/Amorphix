"use client";

import { sayArea, sayLength } from "@/lib/export/drawings";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PlanSvg } from "@/components/plan/PlanSvg";
import { CountUp, Scanning } from "@/components/fx/Motion";
import { ok as okSound, tick } from "@/components/fx/sfx";
import type { Layout, Space } from "@/lib/layout/schema";
import { estimate, marketOf, money, isNewBuild, projectTier } from "@/lib/budget/costs";
import { timeline } from "@/lib/budget/timeline";
import type { Tier } from "@/lib/budget/costs";
import { scoreWith, choicesOf, type Ticked } from "@/lib/green/improve";
import { look } from "@/lib/three/materials";
import { HOME_TYPES } from "@/lib/interview/living";
import { ADDABLE, applyChange, describe, type Change } from "@/lib/workspace/edit";
import { suggestions, understand } from "@/lib/workspace/understand";

const HouseScene = dynamic(() => import("@/components/three/HouseScene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <Scanning label="Building your 3D model" />
    </div>
  ),
});

type Brief = Parameters<typeof look>[0] & { plants?: { name: string }[] };
type Project = {
  status?: string;
  id: string;
  space_type: string | null;
  site: { width?: number; depth?: number; location?: string; units?: "imperial" | "metric" };
  interview: Record<string, unknown>;
  brief: unknown;
  taste: Parameters<typeof look>[1];
  options?: Layout[] | null;
  chosen_option: number | null;
};
type Version = { version: number; note: string; created_at: string };

// "Make it yours": change the chosen plan by tapping a room or typing what you want, and see the plan, the 3D model,
// the budget, the timeline and the green score follow at once. Each change is worked out in the browser first, so it
// shows instantly; the server works it out again, saves it as a version, and can step back with Undo.
export function Workspace<P extends Project>({ p, tier, ticked, onProject, onDone }: { p: P; tier: Tier | null; ticked: Ticked; onProject: (p: P) => void; onDone: (changes: number) => void }) {
  const still = useReducedMotion();
  const layout = p.options?.[p.chosen_option ?? 0];
  const units = p.site.units ?? "imperial";
  const [view, setView] = useState<"plan" | "3d">("plan");
  const [level, setLevel] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [hints, setHints] = useState<string[] | null>(null);
  // Changes saved since opening the workspace, for the note on the walkthrough afterwards.
  const [made, setMade] = useState(0);

  const loadVersions = useCallback(() => {
    void fetch(`/api/projects/${p.id}/edit`)
      .then((r) => (r.ok ? r.json() : { versions: [] }))
      .then((b) => setVersions(b.versions ?? []))
      .catch(() => {});
  }, [p.id]);
  useEffect(loadVersions, [loadVersions]);

  const withLayout = useCallback(
    (next: Layout) => {
      const options = [...(p.options ?? [])];
      options[p.chosen_option ?? 0] = next;
      return { ...p, options };
    },
    [p],
  );

  // Sends a change (or words, or undo) to be saved. A change already shown locally only needs the server's copy back.
  const send = useCallback(
    async (body: { change: Change } | { text: string } | { undo: true }, label: string) => {
      setBusy(label);
      try {
        const res = await fetch(`/api/projects/${p.id}/edit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) {
          setNote({ text: out.error ?? "That didn't work. Try again.", bad: true });
          if (out.suggestions) setHints(out.suggestions);
          return false;
        }
        onProject({ ...p, ...out.project });
        // a change to an approved design goes to whoever approves it, with what it does to the cost
        setNote({ text: out.request ? `${out.note}. Sent for approval as a change (${out.request.cost}); it's built once approved.` : out.note });
        setMade((n) => Math.max(0, n + ("undo" in body ? -1 : 1)));
        setHints(null);
        okSound();
        loadVersions();
        return true;
      } catch {
        setNote({ text: "Couldn't save that. Check your connection.", bad: true });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [p, onProject, loadVersions],
  );

  // A change: worked out here and shown at once, then saved. If the server disagrees, its copy wins.
  const change = useCallback(
    (c: Change) => {
      if (!layout) return;
      tick();
      const out = applyChange(layout, c, { width: p.site.width ?? 0, depth: p.site.depth ?? 0 });
      if ("error" in out) {
        setNote({ text: out.error, bad: true });
        return;
      }
      const before = p;
      onProject(withLayout(out.layout));
      setNote({ text: describe(c, layout) });
      if (c.op === "remove") setSelected(null);
      void send({ change: c }, "Saving").then((saved) => {
        if (!saved) onProject(before);
      });
    },
    [layout, p, onProject, withLayout, send],
  );

  const submit = (words: string) => {
    const t = words.trim();
    if (!t || !layout) return;
    setText("");
    const c = understand(t, layout);
    // Read by the plain rules: instant. Otherwise the server asks the model.
    if (c) change(c);
    else void send({ text: t }, "Reading your request");
  };

  const rooms = useMemo(() => (layout ? layout.floors.flatMap((f) => f.spaces.filter((s) => s.zone !== "circulation").map((s) => ({ ...s, level: f.level }))) : []), [layout]);
  const room = rooms.find((r) => r.id === selected) ?? null;
  const home = HOME_TYPES.has(p.space_type ?? "house");
  // Open or closed is a choice for a home's kitchen or a café's; an office pantry isn't offered it.
  const kitchen = home || p.space_type === "cafe" ? rooms.find((r) => r.kind === "kitchen") : undefined;

  // The numbers along the bottom, worked out from the plan as it is now.
  const market = marketOf(p.site.location);
  const newBuild = isNewBuild(p);
  const active: Tier = tier ?? projectTier(p);
  const brief = p.brief as Brief | null;
  const cost = useMemo(() => (layout ? estimate(layout, active, market, newBuild, p.site.location) : null), [layout, active, market, newBuild, p.site.location]);
  const weeks = useMemo(() => (layout ? timeline(layout, active, newBuild).weeks : 0), [layout, active, newBuild]);
  const green = useMemo(() => {
    if (!layout) return 0;
    const lot = p.site.width && p.site.depth ? { width: p.site.width, depth: p.site.depth } : null;
    return scoreWith({ layout, briefPlants: brief?.plants ?? [], lot, lush: look(brief, p.taste).lush }, choicesOf(ticked)).score;
  }, [layout, brief, p.taste, p.site.width, p.site.depth, ticked]);

  if (!layout) return <p className="p-10 text-center text-ink-soft">Choose a plan first, then come back to make it yours.</p>;
  const floors = layout.floors.length;
  const pick = (x: number, z: number) => {
    const hit = layout.floors.find((f) => f.level === level)?.spaces.find((s) => s.zone !== "circulation" && x >= s.rect.x && x <= s.rect.x + s.rect.w && z >= s.rect.y && z <= s.rect.y + s.rect.h);
    tick();
    setSelected(hit?.id ?? null);
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">Workspace</p>
          <h1 className="mt-1 font-serif text-4xl">Make it yours</h1>
          {(p.status === "approved" || p.status === "building") && (
            <p className="mt-2 max-w-xl rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
              This design is approved. Changes you make here become a <strong>change request</strong>, with what they do to the cost, and wait in the thread
              for approval; until then the approved version is what gets built.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
        <AnimatePresence mode="wait">
          {note && (
            <motion.p
              key={note.text}
              initial={still ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`rounded-full border px-4 py-1.5 text-sm ${note.bad ? "border-accent/50 text-accent" : "border-leaf/50 text-leaf"}`}
            >
              {note.bad ? "" : "✓ "}
              {note.text}
            </motion.p>
          )}
        </AnimatePresence>
        {/* every change is saved as it's made; this is the clear way out to see it */}
        <button type="button" disabled={!!busy} onClick={() => onDone(made)} className="glow-btn px-5 py-2.5 disabled:opacity-50">
          Save &amp; walk through it
        </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* the controls */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-line bg-paper-raised p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(text);
              }}
              className="flex gap-2"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tell Amorphix what to change…"
                aria-label="What to change"
                className="h-11 min-w-0 flex-1 rounded-full border border-line bg-paper px-4 outline-none focus:border-accent"
              />
              <button type="submit" disabled={!text.trim() || !!busy} className="glow-btn h-11 px-4 disabled:opacity-40">
                Change it
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(hints ?? suggestions(layout)).map((s) => (
                <button key={s} type="button" onClick={() => submit(s)} className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition hover:border-accent hover:text-accent">
                  {s}
                </button>
              ))}
            </div>
            {busy && (
              <div className="mt-3">
                <Scanning label={busy} />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-paper-raised p-4">
            {room ? (
              <RoomCard units={units} key={room.id} room={room} onChange={change} onClose={() => setSelected(null)} />
            ) : (
              <p className="text-sm text-ink-soft">Tap a room on the plan to resize, rename or remove it.</p>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-paper-raised p-4">
            <h2 className="text-xs uppercase tracking-widest text-ink-soft">Add a room</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ADDABLE.filter((a) => (home ? a.kind !== "meeting" : !["prayer", "gym", "media", "guest-room", "laundry"].includes(a.kind))).map((a) => (
                <button key={a.kind} type="button" onClick={() => change({ op: "add", kind: a.kind, name: a.name })} className="rounded-full border border-line px-3 py-1 text-sm transition hover:border-accent hover:text-accent">
                  + {a.name}
                </button>
              ))}
            </div>
            {kitchen && (
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="text-sm">{kitchen.name}</span>
                <div className="flex rounded-full border border-line p-0.5 text-sm" role="radiogroup" aria-label="Kitchen">
                  {[
                    [true, "Open"],
                    [false, "Own room"],
                  ].map(([open, label]) => {
                    const on = (kitchen.open !== false) === open;
                    return (
                      <button key={String(open)} type="button" role="radio" aria-checked={on} onClick={() => !on && change({ op: "kitchen", open: open as boolean })} className={`rounded-full px-3 py-1 ${on ? "bg-btn text-btn-ink" : "text-ink-soft"}`}>
                        {label as string}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-paper-raised p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-widest text-ink-soft">History</h2>
              <button type="button" disabled={versions.length < 2 || !!busy} onClick={() => void send({ undo: true }, "Stepping back")} className="rounded-full border border-line px-3 py-1 text-sm transition hover:border-accent disabled:opacity-40">
                ↺ Undo
              </button>
            </div>
            <ol className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
              {versions.length === 0 && <li className="text-ink-soft">Your changes will appear here.</li>}
              {versions.map((v, i) => (
                <li key={v.version} className={`flex gap-2 ${i === 0 ? "" : "text-ink-soft"}`}>
                  <span className="font-mono text-xs text-ink-soft">v{v.version}</span>
                  {v.note}
                </li>
              ))}
            </ol>
          </section>
        </aside>

        {/* the canvas */}
        <section className="relative overflow-hidden rounded-2xl border border-line bg-paper-raised">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <div className="flex rounded-full border border-line p-0.5 text-sm" role="tablist">
              {(["plan", "3d"] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-full px-4 py-1 ${view === v ? "bg-btn text-btn-ink" : "text-ink-soft"}`}>
                  {v === "plan" ? "Plan" : "3D"}
                </button>
              ))}
            </div>
            {floors > 1 && (
              <div className="flex rounded-full border border-line p-0.5 text-sm" role="radiogroup" aria-label="Floor">
                {layout.floors.map((f) => (
                  <button key={f.level} type="button" role="radio" aria-checked={level === f.level} onClick={() => setLevel(f.level)} className={`rounded-full px-3 py-1 ${level === f.level ? "bg-btn text-btn-ink" : "text-ink-soft"}`}>
                    {f.level === 0 ? "Ground" : "Upstairs"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative h-[62vh] min-h-[420px]">
            {view === "plan" ? (
              <motion.div key={JSON.stringify(layout.floors[level]?.spaces.map((s) => s.rect))} initial={still ? false : { opacity: 0.4, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} className="grid h-full place-items-center p-4">
                <PlanSvg layout={layout} level={level} units={units} className="max-h-full w-full cursor-pointer" onPick={pick}>
                  {room && room.level === level && (
                    <rect x={room.rect.x} y={room.rect.y} width={room.rect.w} height={room.rect.h} fill="var(--accent)" fillOpacity={0.14} stroke="var(--accent)" strokeWidth={0.12} pointerEvents="none" />
                  )}
                </PlanSvg>
              </motion.div>
            ) : (
              <HouseScene layout={layout} brief={p.brief as never} taste={p.taste} newBuild={(p.interview?.project as { newBuild?: boolean } | undefined)?.newBuild === true} mode="orbit" cutaway upTo={level} playing={false} wheelZoom />
            )}
          </div>
        </section>
      </div>

      {/* what the plan costs, takes and grows, after every change */}
      <ToScreen>
      <div className="fixed bottom-0 right-0 left-[var(--shell-w,0px)] z-30 border-t border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <Stat label="Budget">
            {cost ? (
              <>
                <CountUp value={cost.total.low} format={(v) => money(v, market)} /> to <CountUp value={cost.total.high} format={(v) => money(v, market)} />
              </>
            ) : (
              "–"
            )}
          </Stat>
          <Stat label="Timeline">
            <CountUp value={weeks} /> weeks
          </Stat>
          <Stat label="Green score" tone="text-leaf">
            <CountUp value={green} />
          </Stat>
          <Stat label="Floor area">
            {units === "imperial" ? <><CountUp value={Math.round((cost?.area ?? 0) * 10.7639)} /> sq ft</> : <><CountUp value={cost?.area ?? 0} /> m²</>}
          </Stat>
        </div>
      </div>
      </ToScreen>
    </main>
  );
}

// The step pages slide in with a transform, which would pin a fixed bar to the page instead of the screen; on the
// page body it stays at the bottom of the screen.
function ToScreen({ children }: { children: ReactNode }) {
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => setBody(document.body), []);
  return body ? createPortal(children, body) : null;
}

function Stat({ label, children, tone = "text-ink" }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">{label}</p>
      <p className={`font-serif text-2xl leading-tight ${tone}`}>{children}</p>
    </div>
  );
}

// The room someone tapped: rename it, make it bigger or smaller, or take it out.
function RoomCard({ room, units, onChange, onClose }: { room: Space & { level: number }; units: "imperial" | "metric"; onChange: (c: Change) => void; onClose: () => void }) {
  const [name, setName] = useState(room.name);
  const area = room.rect.w * room.rect.h;
  const rename = () => {
    const n = name.trim();
    if (n && n !== room.name) onChange({ op: "rename", room: room.id, name: n });
  };
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          aria-label="Room name"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 font-serif text-2xl outline-none hover:border-line focus:border-accent"
        />
        <button type="button" onClick={onClose} aria-label="Close" className="px-1 text-ink-soft hover:text-ink">
          ×
        </button>
      </div>
      <p className="px-1 text-sm text-ink-soft">
        {sayArea(area, units)} · {sayLength(room.rect.w, units)} × {sayLength(room.rect.h, units)} · {room.level ? "upstairs" : "ground floor"}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button type="button" onClick={() => onChange({ op: "resize", room: room.id, by: 1.25 })} className="rounded-xl border border-line py-2 text-sm transition hover:border-accent hover:text-accent">
          ＋ Bigger
        </button>
        <button type="button" onClick={() => onChange({ op: "resize", room: room.id, by: 0.8 })} className="rounded-xl border border-line py-2 text-sm transition hover:border-accent hover:text-accent">
          − Smaller
        </button>
        <button type="button" onClick={() => onChange({ op: "remove", room: room.id })} className="rounded-xl border border-line py-2 text-sm transition hover:border-red-400 hover:text-red-500">
          Remove
        </button>
      </div>
    </div>
  );
}
