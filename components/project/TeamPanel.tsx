"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import QRCode from "qrcode";
import { ROLE_CAN, ROLE_NAME, type MemberRole, type ProjectRole } from "@/lib/project/access";
import { ok, tick } from "@/components/fx/sfx";
import { Scanning } from "@/components/fx/Motion";
import { ROLE_SHORT, type Role } from "@/lib/account/roles";

type Member = { user_id: string; role: ProjectRole; name: string | null; email: string | null; company: string | null; kind: Role | null };
type Invite = { token: string; role: MemberRole; expires_at: string };
type Team = { role: ProjectRole; signedIn: boolean; me: string | null; members: Member[]; invites: Invite[]; invitable: MemberRole[] };

const linkOf = (token: string) => `${window.location.origin}/join/${token}`;
const initials = (m: Member) => (m.name ?? m.email ?? "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

// The team on a project: who is on it, and invite links with a QR code. Opened from the profile menu.
/** `want`: the role this was opened for ("Invite my builder"), selected if it can be invited. */
export function TeamPanel({ id, onClose, want }: { id: string; onClose: () => void; want?: MemberRole }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [role, setRole] = useState<MemberRole | null>(null);
  const [fresh, setFresh] = useState<{ token: string; qr: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Hand over" asks once more before giving the project away.
  const [handing, setHanding] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetch(`/api/projects/${id}/team`)
        .then((res) => (res.ok ? (res.json() as Promise<Team>) : Promise.reject()))
        .then((t) => {
          setTeam(t);
          setRole((r) => r ?? t.invitable.find((x) => x === want) ?? t.invitable.find((x) => x === "client") ?? t.invitable[0] ?? null);
        })
        .catch(() => setError("Couldn't load the team.")),
    [id],
  );

  useEffect(() => {
    void load();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [load, onClose]);

  async function invite() {
    if (!role) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${id}/team`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Couldn't make the invite.");
    const qr = await QRCode.toDataURL(linkOf(body.token), { margin: 1, width: 360, color: { dark: "#0e1a2b", light: "#ffffff" } });
    ok();
    setFresh({ token: body.token, qr });
    setCopied(false);
    void load();
  }

  async function handOver(userId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${id}/handover`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) });
    setBusy(false);
    setHanding(null);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Couldn't hand it over.");
    ok();
    window.location.reload();
  }

  async function copy(token: string) {
    await navigator.clipboard.writeText(linkOf(token)).catch(() => {});
    tick();
    setCopied(true);
  }

  async function remove(body: { token: string } | { user: string }) {
    const res = await fetch(`/api/projects/${id}/team`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Couldn't remove that.");
    if ("token" in body && fresh?.token === body.token) setFresh(null);
    void load();
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside
        role="dialog"
        aria-label="Team"
        className="h-full w-full max-w-md overflow-y-auto border-l border-line bg-paper p-6 shadow-2xl"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-3xl">Team</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-paper-raised hover:text-ink">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-soft">Everyone on this project sees the same design, live.</p>

        {!team ? (
          <div className="mt-10 grid place-items-center">
            <Scanning label="Loading the team" />
          </div>
        ) : (
          <>
            <ul className="mt-6 space-y-2">
              {team.members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 rounded-2xl border border-line bg-paper-raised p-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-btn text-sm text-btn-ink">{initials(m)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {m.name ?? m.email}
                      {m.user_id === team.me && <span className="text-ink-soft"> (you)</span>}
                    </p>
                    <p className="truncate text-xs text-ink-soft">{[m.kind && m.kind !== "owner" && ROLE_SHORT[m.kind], m.company, m.email].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-accent">{m.role === "owner" && (m.kind === "architect" || m.kind === "builder") ? ROLE_NAME[m.kind] : ROLE_NAME[m.role]}</span>
                  {team.role === "owner" && m.role === "architect" && team.me && (
                    <button
                      onClick={() => (handing === m.user_id ? handOver(m.user_id) : (tick(), setHanding(m.user_id)))}
                      className={`text-xs ${handing === m.user_id ? "font-medium text-accent" : "text-ink-soft hover:text-accent"}`}
                      title="They run the project from their studio; you stay on as the client"
                    >
                      {handing === m.user_id ? "Confirm hand over?" : "Hand over"}
                    </button>
                  )}
                  {team.role === "owner" && m.role !== "owner" && (
                    <button onClick={() => remove({ user: m.user_id })} aria-label={`Remove ${m.name ?? m.email}`} className="text-xs text-ink-soft hover:text-red-600">
                      Remove
                    </button>
                  )}
                </li>
              ))}
              {team.members.length === 0 && <li className="text-sm text-ink-soft">Just you so far, as a guest.</li>}
            </ul>

            {team.invitable.length > 0 ? (
              <section className="mt-8 rounded-2xl border border-line bg-paper-raised p-4">
                <p className="font-medium">Invite someone</p>
                <div role="radiogroup" aria-label="Their role" className="mt-3 grid gap-2">
                  {team.invitable.map((r) => (
                    <button
                      key={r}
                      role="radio"
                      aria-checked={role === r}
                      onClick={() => {
                        tick();
                        setRole(r);
                        setFresh(null);
                      }}
                      className={`rounded-xl border px-3 py-2 text-left transition ${role === r ? "border-accent bg-accent/5" : "border-line hover:border-accent/50"}`}
                    >
                      <span className="text-sm font-medium">{ROLE_NAME[r]}</span>
                      <span className="block text-xs text-ink-soft">{ROLE_CAN[r]}</span>
                    </button>
                  ))}
                </div>
                {fresh ? (
                  <div className="mt-4 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fresh.qr} alt="QR code for the invite link" className="mx-auto h-44 w-44 rounded-xl border border-line bg-white p-2" />
                    <p className="mt-2 text-xs text-ink-soft">Scan to join as {ROLE_NAME[role ?? "viewer"].toLowerCase()}, or send the link. It works once, for 7 days.</p>
                    <div className="mt-3 flex gap-2">
                      <input readOnly value={linkOf(fresh.token)} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-full border border-line bg-paper px-3 py-2 text-xs" aria-label="Invite link" />
                      <button onClick={() => copy(fresh.token)} className="glow-btn rounded-full px-4 py-2 text-sm">
                        {copied ? "Copied ✓" : "Copy"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={invite} disabled={busy || !role} className="glow-btn mt-4 w-full rounded-full px-4 py-2.5 text-sm disabled:opacity-60">
                    {busy ? "Making the link…" : `Make an invite link for the ${ROLE_NAME[role ?? "viewer"].toLowerCase()}`}
                  </button>
                )}
              </section>
            ) : !team.signedIn ? (
              <section className="mt-8 rounded-2xl border border-dashed border-line p-4 text-sm">
                <p className="font-medium">Want to bring in your architect, client or builder?</p>
                <p className="mt-1 text-ink-soft">Create a free account first, so they know who the invite is from. This project comes with you.</p>
                <a href={`/login?mode=signup&next=${encodeURIComponent(`/project/${id}`)}`} className="glow-btn mt-3 inline-block rounded-full px-5 py-2">
                  Create a free account
                </a>
              </section>
            ) : null}

            {team.invites.length > 0 && (
              <section className="mt-6">
                <p className="text-xs uppercase tracking-widest text-ink-soft">Waiting to join</p>
                <ul className="mt-2 space-y-1.5">
                  {team.invites.map((i) => (
                    <li key={i.token} className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-sm">
                      <span>
                        {ROLE_NAME[i.role]} <span className="text-xs text-ink-soft">· until {new Date(i.expires_at).toLocaleDateString("en", { day: "numeric", month: "short" })}</span>
                      </span>
                      <span className="flex gap-3">
                        <button onClick={() => copy(i.token)} className="text-xs text-accent hover:underline">
                          Copy link
                        </button>
                        <button onClick={() => remove({ token: i.token })} className="text-xs text-ink-soft hover:text-red-600">
                          Cancel
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}
      </motion.aside>
    </motion.div>
  );
}
