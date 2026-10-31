"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/account/roles";
import type { Profile } from "@/lib/account/profile";
import { Decode } from "@/components/fx/Decode";
import { ok, tick } from "@/components/fx/sfx";

const ROLE_LINE: Record<Role, string> = {
  owner: "Design my home, café, office, shop or hotel, then share it with my architect or builder.",
  architect: "Run projects for my clients: they review, comment and approve.",
  builder: "Build from approved designs and track the site, crew and materials.",
};
const ROLE_ICON: Record<Role, string> = { owner: "⌂", architect: "✎", builder: "⚒" };
const TRADES = ["Civil", "Masonry", "Carpentry", "Electrical", "Plumbing", "Tiling", "Painting", "Interiors", "Landscaping"];

type Draft = { role: Role | null; name: string; company: string; city: string; units: "metric" | "imperial"; crew_size: string; trades: string[]; about: string; fee_note: string; listed: boolean };

// Sign-up step 2, and the account page: pick a role, then a short profile for that role.
export function ProfileForm({ initial, email, next, editing }: { initial: Profile | null; email: string | null; next: string; editing?: boolean }) {
  const [d, setD] = useState<Draft>({
    role: initial?.role ?? null,
    name: initial?.name ?? "",
    company: initial?.company ?? "",
    city: initial?.city ?? "",
    units: initial?.units ?? "metric",
    crew_size: initial?.crew_size ? String(initial.crew_size) : "",
    trades: initial?.trades ?? [],
    about: initial?.about ?? "",
    fee_note: initial?.fee_note ?? "",
    listed: initial?.listed ?? true,
  });
  const [stage, setStage] = useState<"role" | "details">(initial ? "details" : "role");
  const [logo, setLogo] = useState<string | null>(initial?.logo_url ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<Draft>) => setD((v) => ({ ...v, ...patch }));
  const pro = d.role === "architect" || d.role === "builder";

  async function upload(file: File) {
    setError(null);
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/profile/logo", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "Upload failed.");
    setLogo(body.logo_url);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...d, crew_size: d.crew_size ? Number(d.crew_size) : null }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Couldn't save. Please try again.");
    ok();
    if (editing) setSaved(true);
    else window.location.assign(next);
  }

  const input = "w-full rounded-xl border border-line bg-paper-raised px-4 py-2.5 outline-none transition focus:border-accent";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <AnimatePresence mode="wait">
        {stage === "role" ? (
          <motion.div key="role" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">Step 1 of 2</p>
            <h1 className="mt-2 font-serif text-4xl">
              <Decode text="Who are you designing as?" />
            </h1>
            {email && <p className="mt-2 text-ink-soft">Signed in as {email}</p>}
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {ROLES.map((r, i) => (
                <motion.button
                  key={r}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  onClick={() => {
                    tick();
                    set({ role: r });
                    setStage("details");
                  }}
                  className={`group rounded-2xl border bg-paper-raised p-5 text-left transition hover:-translate-y-0.5 hover:border-accent ${d.role === r ? "border-accent" : "border-line"}`}
                >
                  <span aria-hidden className="text-2xl text-accent">
                    {ROLE_ICON[r]}
                  </span>
                  <p className="mt-2 font-medium">{ROLE_LABEL[r]}</p>
                  <p className="mt-1 text-sm text-ink-soft">{ROLE_LINE[r]}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.form key="details" onSubmit={save} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            {!editing && <p className="text-xs uppercase tracking-[0.25em] text-accent">Step 2 of 2</p>}
            <h1 className="mt-2 font-serif text-4xl">
              <Decode text={editing ? "Your account" : "A little about you"} />
            </h1>
            <p className="mt-2 text-ink-soft">
              {d.role && ROLE_LABEL[d.role]} ·{" "}
              <button type="button" onClick={() => setStage("role")} className="text-accent hover:underline">
                change
              </button>
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm">
                Your name
                <input required maxLength={80} value={d.name} onChange={(e) => set({ name: e.target.value })} className={input} autoComplete="name" />
              </label>
              {d.role && (
                <label className="grid gap-1.5 text-sm">
                  {d.role === "architect" ? "Studio name" : d.role === "builder" ? "Company name" : "Business name, if it's for a business"}
                  <input required={pro} maxLength={100} value={d.company} onChange={(e) => set({ company: e.target.value })} className={input} autoComplete="organization" />
                </label>
              )}
              <label className="grid gap-1.5 text-sm">
                City
                <input maxLength={80} value={d.city} onChange={(e) => set({ city: e.target.value })} className={input} placeholder="Austin, Brooklyn, London…" />
              </label>
              <fieldset className="grid gap-1.5 text-sm">
                <legend className="mb-1.5">Units</legend>
                <div className="grid grid-cols-2 gap-1 rounded-full border border-line p-1">
                  {(["metric", "imperial"] as const).map((u) => (
                    <button key={u} type="button" aria-pressed={d.units === u} onClick={() => set({ units: u })} className={`rounded-full px-3 py-1.5 transition ${d.units === u ? "bg-btn text-btn-ink" : "text-ink-soft hover:text-ink"}`}>
                      {u === "metric" ? "Metres" : "Feet"}
                    </button>
                  ))}
                </div>
              </fieldset>
              {d.role === "builder" && (
                <>
                  <label className="grid gap-1.5 text-sm">
                    Crew size
                    <input type="number" min={1} max={10000} value={d.crew_size} onChange={(e) => set({ crew_size: e.target.value })} className={input} />
                  </label>
                  <fieldset className="sm:col-span-2">
                    <legend className="text-sm">Trades you cover</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {TRADES.map((t) => {
                        const on = d.trades.includes(t);
                        return (
                          <button key={t} type="button" aria-pressed={on} onClick={() => set({ trades: on ? d.trades.filter((x) => x !== t) : [...d.trades, t] })} className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-accent bg-accent/10 text-accent" : "border-line text-ink-soft hover:text-ink"}`}>
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </>
              )}
              {(d.role === "architect" || d.role === "builder") && (
                <>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    About your work <span className="text-xs text-ink-soft">Shown to clients looking for a {d.role === "architect" ? "designer" : "builder"}</span>
                    <textarea maxLength={400} rows={2} value={d.about} onChange={(e) => set({ about: e.target.value })} className={input} placeholder="Warm, natural homes in Austin since 2015" />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    Fees
                    <input maxLength={120} value={d.fee_note} onChange={(e) => set({ fee_note: e.target.value })} className={input} placeholder="From ₹80 per sq ft" />
                  </label>
                  <label className="flex items-center gap-3 self-end text-sm">
                    <input type="checkbox" checked={d.listed} onChange={(e) => set({ listed: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                    Suggest me to new clients
                  </label>
                </>
              )}
              {pro && (
                <div className="sm:col-span-2">
                  <p className="text-sm">Logo</p>
                  <p className="text-xs text-ink-soft">Shown on the links and PDFs you send to clients. PNG, JPG or WebP, up to 1 MB.</p>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border border-line bg-paper-raised">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {logo ? <img src={logo} alt="Your logo" className="h-full w-full object-contain" /> : <span className="text-xs text-ink-soft">None</span>}
                    </div>
                    <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm transition hover:border-accent">
                      {logo ? "Change logo" : "Upload logo"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p role="alert" className="mt-5 text-sm text-red-600">
                {error}
              </p>
            )}
            {saved && !error && (
              <p role="status" className="mt-5 text-sm text-leaf">
                ✓ Saved
              </p>
            )}
            <button type="submit" disabled={busy || !d.role} className="glow-btn mt-8 rounded-full px-7 py-3 disabled:opacity-60">
              {busy ? "Saving…" : editing ? "Save changes" : "Continue"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
