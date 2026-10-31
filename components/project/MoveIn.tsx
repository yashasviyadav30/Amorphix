"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Scanning } from "@/components/fx/Motion";
import { Decode } from "@/components/fx/Decode";
import { chime, ok, tick } from "@/components/fx/sfx";
import type { Check, SnagAction, SnagStatus } from "@/lib/project/movein";

// Moving in: the steps to the handover, the snag list, the handover pack, the client's acceptance, then reviews.

type Snag = { id: number; room: string | null; note: string; status: SnagStatus; author_name: string; created_at: string; actions: SnagAction[] };
type Pro = { id: string; role: string; name: string; review: { rating: number; text: string | null } | null };
type Data = {
  status: string;
  allDone: boolean;
  runs: boolean;
  decides: boolean;
  inPerson: string | null;
  snags: Snag[];
  pack: { warranty_months: number | null; note: string | null; handed_over_at: string | null; until: string | null };
  checks: Check[];
  canAccept: boolean;
  pros: Pro[];
};

const ACTION: Record<SnagAction, string> = { fix: "Mark fixed", close: "Sign it off", reopen: "Not fixed yet" };
const TONE: Record<SnagStatus, string> = { open: "text-amber-600 border-amber-500/40", fixed: "text-accent border-accent/40", closed: "text-leaf border-leaf/40" };
const WORD: Record<SnagStatus, string> = { open: "To fix", fixed: "Fixed, to check", closed: "Signed off" };
const label = "font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft";
const date = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function MoveIn({ projectId, onStatus, onFees }: { projectId: string; onStatus: (s: string) => void; onFees?: () => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [room, setRoom] = useState("");

  const load = useCallback(
    () =>
      fetch(`/api/projects/${projectId}/movein`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((x: Data) => {
          setD(x);
          onStatus(x.status);
        })
        .catch(() => setError("Couldn't load the handover.")),
    [projectId, onStatus],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (body: Record<string, unknown>, sound: () => void = ok) => {
    tick();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/movein`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) setError((await res?.json().catch(() => null))?.error ?? "That didn't go through.");
    else sound();
    await load();
    return !!res?.ok;
  };

  if (!d)
    return (
      <div className="grid place-items-center py-12">
        <Scanning label="Loading the handover" />
      </div>
    );

  const moved = d.status === "done";
  return (
    <div className="space-y-5">
      {moved ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-leaf/40 bg-leaf/5 p-5">
          <p className={label}>Handed over</p>
          <p className="mt-1 font-serif text-3xl">
            <Decode text={`Moved in${d.pack.handed_over_at ? ` on ${date(d.pack.handed_over_at)}` : ""}`} />
          </p>
          {d.pack.until && <p className="mt-1 text-sm text-ink-soft">Under warranty until {date(d.pack.until)}.</p>}
        </motion.section>
      ) : (
        // the steps to the handover, each lit when done
        <section className="rounded-2xl border border-line bg-paper-raised p-5">
          <p className={label}>Moving in</p>
          {/* a compact checklist on a phone, a row of steps on a wider screen */}
          <ol className={`mt-3 grid gap-1.5 sm:gap-2 ${d.checks.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-5"}`}>
            {d.checks.map((c, i) => (
              <li key={c.id} className={`flex flex-wrap items-baseline gap-x-2 rounded-xl border px-3 py-2 text-sm sm:block sm:p-3 ${c.done ? "border-leaf/40 bg-leaf/5" : "border-line"}`}>
                <span className={`w-12 shrink-0 font-mono text-[10px] sm:w-auto ${c.done ? "text-leaf" : "text-ink-soft"}`}>{c.done ? "✓ DONE" : `STEP ${i + 1}`}</span>
                <span className="leading-snug sm:mt-1 sm:block">{c.label}</span>
                {c.note && <span className="text-xs text-ink-soft sm:mt-1 sm:block">{c.note}</span>}
                {c.id === "fees" && !c.done && onFees && (
                  <button onClick={() => (tick(), onFees())} className="mt-1 text-xs text-accent hover:underline">
                    See fees
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* the snag list */}
      <section className="rounded-2xl border border-line bg-paper-raised p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-serif text-2xl">Snag list</p>
          <p className="text-sm text-ink-soft">Walk through it together; list anything that needs fixing, room by room.</p>
        </div>
        {d.snags.length > 0 ? (
          <ul className="mt-4 divide-y divide-line">
            {d.snags.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className={`w-28 shrink-0 rounded-full border px-2 py-0.5 text-center text-xs ${TONE[s.status]}`}>{WORD[s.status]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">
                    {s.room && <span className="font-medium">{s.room}: </span>}
                    {s.note}
                  </span>
                  <span className="block text-xs text-ink-soft">from {s.author_name.split(" ")[0]}</span>
                </span>
                <span className="flex gap-1.5">
                  {s.actions.map((a) => (
                    <button key={a} disabled={busy} onClick={() => act({ op: "snag.step", id: s.id, action: a })} className={`rounded-full px-3 py-1 text-xs disabled:opacity-60 ${a === "reopen" ? "border border-line hover:border-accent" : "glow-btn"}`}>
                      {ACTION[a]}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">{d.allDone ? "Nothing listed. If it's all as it should be, go on to the handover." : "Snags can be listed as the last phases finish."}</p>
        )}
        {!moved && (
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (note.trim() && (await act({ op: "snag.add", note, room: room || undefined }))) {
                setNote("");
                setRoom("");
              }
            }}
          >
            <input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={60} placeholder="Room (optional)" aria-label="Room" className="w-40 rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What needs fixing? e.g. the bathroom door sticks" aria-label="What needs fixing" className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
            <button disabled={busy || !note.trim()} className="glow-btn rounded-full px-5 py-2 text-sm disabled:opacity-50">
              Add snag
            </button>
          </form>
        )}
      </section>

      {/* the handover pack */}
      <Pack d={d} busy={busy} act={act} />

      {d.canAccept && (
        <section className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
          <p className="font-serif text-2xl">{d.inPerson ? `${d.inPerson}'s handover` : "Ready to move in?"}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {d.snags.some((s) => s.status !== "closed") ? "Some snags are still open; they stay on the list after the handover, under the warranty. " : ""}
            {d.checks.some((c) => c.id === "fees" && !c.done) ? `Fees aren't settled yet (${d.checks.find((c) => c.id === "fees")?.note}): they stay due after you move in. ` : ""}
            Accepting the handover marks the project moved in{d.pack.warranty_months ? `, and the ${d.pack.warranty_months}-month warranty starts today` : ""}.
          </p>
          <button disabled={busy} onClick={() => act({ op: "accept" }, chime)} className="glow-btn mt-4 rounded-full px-6 py-2.5 text-sm disabled:opacity-60">
            {d.inPerson ? `${d.inPerson} accepted the handover (in person)` : "Accept the handover and move in"}
          </button>
        </section>
      )}

      {moved && d.pros.length > 0 && <Reviews pros={d.pros} busy={busy} act={act} />}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function Pack({ d, busy, act }: { d: Data; busy: boolean; act: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [months, setMonths] = useState(d.pack.warranty_months ?? 12);
  const [note, setNote] = useState(d.pack.note ?? "");
  const [editing, setEditing] = useState(false);
  const set = d.pack.warranty_months !== null;
  return (
    <section className="rounded-2xl border border-line bg-paper-raised p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-serif text-2xl">Handover pack</p>
        <p className="text-sm text-ink-soft">The warranty, how to look after it, and the drawings (Files tab).</p>
      </div>
      {d.runs && (editing || !set) && d.status !== "done" ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act({ op: "pack", warranty_months: months, note })) setEditing(false);
          }}
        >
          <label className="flex flex-wrap items-center gap-2 text-sm">
            Warranty
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="rounded-lg border border-line bg-paper px-2 py-1">
              {[6, 12, 24, 60, 120].map((m) => (
                <option key={m} value={m}>
                  {m >= 12 ? `${m / 12} year${m === 12 ? "" : "s"}` : `${m} months`}
                </option>
              ))}
            </select>
            from the handover
          </label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={4000} placeholder="Notes for the owner: who to call, the paint colours used, how to look after the floors…" className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
          <button disabled={busy} className="glow-btn rounded-full px-5 py-2 text-sm disabled:opacity-60">
            Hand over the pack
          </button>
        </form>
      ) : set ? (
        <div className="mt-3 text-sm">
          <p>
            <span className="font-medium">{d.pack.warranty_months}-month warranty</span>
            {d.pack.until ? `, until ${date(d.pack.until)}` : ", from the handover"}
          </p>
          {d.pack.note && <p className="mt-2 whitespace-pre-line text-ink-soft">{d.pack.note}</p>}
          {d.runs && d.status !== "done" && (
            <button onClick={() => (tick(), setEditing(true))} className="mt-2 text-xs text-accent hover:underline">
              Change
            </button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-soft">The builder adds the warranty and notes when the build is finished.</p>
      )}
    </section>
  );
}

function Reviews({ pros, busy, act }: { pros: Pro[]; busy: boolean; act: (b: Record<string, unknown>) => Promise<boolean> }) {
  return (
    <section className="rounded-2xl border border-line bg-paper-raised p-5">
      <p className="font-serif text-2xl">How did they do?</p>
      <p className="mt-1 text-sm text-ink-soft">Your review shows on their profile in Find a pro, and helps the next person choose.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {pros.map((p) => (
          <Review key={p.id} pro={p} busy={busy} act={act} />
        ))}
      </div>
    </section>
  );
}

function Review({ pro, busy, act }: { pro: Pro; busy: boolean; act: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [rating, setRating] = useState(pro.review?.rating ?? 0);
  const [text, setText] = useState(pro.review?.text ?? "");
  const [saved, setSaved] = useState(!!pro.review);
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="font-medium">
        {pro.name} <span className="text-sm font-normal text-ink-soft">· {pro.role}</span>
      </p>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label={`Rate ${pro.name}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => (tick(), setRating(n), setSaved(false))} className={`text-2xl leading-none transition ${n <= rating ? "text-amber-500" : "text-line hover:text-amber-300"}`}>
            ★
          </button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => (setText(e.target.value), setSaved(false))} rows={2} maxLength={1000} placeholder="A line about working with them (optional)" className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
      <button disabled={busy || !rating || saved} onClick={async () => (await act({ op: "review", pro_id: pro.id, rating, text })) && setSaved(true)} className="glow-btn mt-2 rounded-full px-4 py-1.5 text-xs disabled:opacity-50">
        {saved ? "Saved ✓" : "Save review"}
      </button>
    </div>
  );
}
