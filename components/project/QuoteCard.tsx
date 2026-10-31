"use client";

import { useCallback, useEffect, useState } from "react";
import { ok, tick } from "@/components/fx/sfx";

// The builder's quote, on the site. The builder sends one (or a new one); whoever approves the design sees it next to
// Amorphix's estimate and accepts or declines; everyone else sees where it stands. Accepted, it's the site's budget.
type Quote = { id: number; amount: number; currency: string; weeks: number | null; note: string | null; status: "sent" | "accepted" | "declined" | "withdrawn"; builder: string };
type Data = { quote: Quote | null; against: string | null; estimate: { low: number; high: number } | null; currency: string; canSend: boolean; canAnswer: boolean; inPerson: string | null };

const money = (v: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

export function QuoteCard({ projectId, onChange }: { projectId: string; onChange?: () => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [amount, setAmount] = useState("");
  const [weeks, setWeeks] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/quote`).catch(() => null);
    if (res?.ok) setD(await res.json());
  }, [projectId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    tick();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/quote`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError((await res?.json().catch(() => null))?.error ?? "That didn't go through.");
    ok();
    setWriting(false);
    setNote("");
    await load();
    onChange?.();
  }

  if (!d) return null;
  const q = d.quote;
  const live = q && q.status !== "withdrawn" ? q : null;
  // nothing to show to someone who can't send one and has none to see
  if (!live && !d.canSend) return null;
  const range = d.estimate ? `${money(d.estimate.low, d.currency)} to ${money(d.estimate.high, d.currency)}` : null;

  return (
    <section className="rounded-2xl border border-line bg-paper-raised p-5">
      <p className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">The builder&apos;s quote</span>
        {range && <span className="text-xs text-ink-soft">Amorphix&apos;s estimate {range}</span>}
      </p>

      {live && (
        <div className="mt-2">
          <p className="font-serif text-3xl">{money(live.amount, live.currency)}</p>
          <p className="mt-1 text-sm text-ink-soft">
            From {live.builder}
            {d.against ? ` · ${d.against}` : ""}
            {live.weeks ? ` · ${live.weeks} weeks` : ""}
          </p>
          {live.note && <p className="mt-2 text-sm">&ldquo;{live.note}&rdquo;</p>}
          <p className={`mt-3 inline-block rounded-full px-3 py-1 text-xs ${live.status === "accepted" ? "bg-leaf/10 text-leaf" : live.status === "declined" ? "bg-red-500/10 text-red-600" : "bg-accent/10 text-accent"}`}>
            {live.status === "accepted" ? "✓ Accepted: it's the site's budget" : live.status === "declined" ? "Declined" : d.canAnswer ? "Waiting for your answer" : "Waiting for an answer"}
          </p>
        </div>
      )}

      {d.canAnswer && live?.status === "sent" && (
        <div className="mt-4 space-y-2">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="A note (optional)" className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => void post({ op: "answer", accept: true, note: note || undefined })} className="rounded-full bg-leaf px-5 py-2 text-sm text-white disabled:opacity-60">
              {d.inPerson ? `✓ ${d.inPerson} accepted it` : "✓ Accept the quote"}
            </button>
            <button disabled={busy} onClick={() => void post({ op: "answer", accept: false, note: note || undefined })} className="rounded-full border border-line px-5 py-2 text-sm transition hover:border-accent disabled:opacity-60">
              {d.inPerson ? `${d.inPerson} declined it` : "Decline"}
            </button>
          </div>
        </div>
      )}

      {d.canSend && !writing && (
        <button onClick={() => (tick(), setWriting(true))} className={`${live ? "mt-4 text-sm text-accent hover:underline" : "glow-btn mt-3 rounded-full px-5 py-2 text-sm"}`}>
          {live ? "Send a new quote" : "Send my quote"}
        </button>
      )}
      {d.canSend && !live && !writing && <p className="mt-2 text-sm text-ink-soft">Your price for the build. Once it&apos;s accepted, it&apos;s the site&apos;s budget instead of Amorphix&apos;s estimate.</p>}

      {d.canSend && writing && (
        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(amount.replace(/[^\d.]/g, ""));
            if (!n) return setError("Enter your price for the build.");
            void post({ op: "send", amount: n, weeks: Number(weeks) || undefined, note: note || undefined });
          }}
        >
          <div className="flex flex-wrap gap-2">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={`Total, in ${d.currency}`} aria-label="Total" className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
            <input value={weeks} onChange={(e) => setWeeks(e.target.value)} inputMode="numeric" placeholder="Weeks (optional)" aria-label="Weeks" className="w-36 rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder="What's included, what isn't (optional)" className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
          <div className="flex gap-2">
            <button disabled={busy} className="glow-btn rounded-full px-5 py-2 text-sm disabled:opacity-60">
              {busy ? "Sending…" : "Send the quote"}
            </button>
            <button type="button" onClick={() => setWriting(false)} className="rounded-full border border-line px-5 py-2 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
