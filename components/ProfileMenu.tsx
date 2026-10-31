"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { setSound, soundOn, tick } from "./fx/sfx";
import { TeamPanel } from "./project/TeamPanel";
import { ROLE_SHORT, type Role } from "@/lib/account/roles";

type Mode = "light" | "dark" | "system";
type Me = { user: { id: string; email: string | null } | null; profile?: { name: string; company: string | null; role: Role; logo_url?: string | null } | null };
const KEY = "amorphix-theme";

// The round face of the profile button in the sidebar: the studio's logo, the first letter, or a plain figure.
function Avatar({ side, children }: { side: boolean; children: React.ReactNode }) {
  if (!side) return <>{children}</>;
  return <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-btn text-btn-ink ring-2 ring-accent/30">{children}</span>;
}

function apply(mode: Mode) {
  const root = document.documentElement;
  try {
    if (mode === "system") {
      delete root.dataset.theme;
      localStorage.removeItem(KEY);
    } else {
      root.dataset.theme = mode;
      localStorage.setItem(KEY, mode);
    }
  } catch {}
}

// The profile menu, in the header or at the foot of the sidebar (opening upward). Settings sit inside it, with
// Appearance first.
export function ProfileMenu({ placement = "header" }: { placement?: "header" | "sidebar" } = {}) {
  const side = placement === "sidebar";
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [mode, setMode] = useState<Mode>("system");
  const [sound, setSoundState] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [team, setTeam] = useState(false);
  // On a project page the menu also opens that project's team. Read only once the menu is opened (always in the
  // browser), so the header still prerenders.
  const projectId = open || team ? (window.location.pathname.match(/^\/project\/([0-9a-f-]{36})/)?.[1] ?? null) : null;
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The server reads this to know which day "today" is for this person.
    document.cookie = `amorphix_tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}; path=/; max-age=31536000; samesite=lax`;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => m && setMe(m))
      .catch(() => {});
  }, []);

  async function signOut() {
    await fetch("/api/session", { method: "DELETE" }).catch(() => {});
    window.location.assign("/");
  }

  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setMode(t === "light" || t === "dark" ? t : "system");
    setSoundState(soundOn());
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const choose = (m: Mode) => {
    apply(m);
    setMode(m);
  };

  const initial = me?.user ? (me.profile?.name || me.user.email || "").trim().charAt(0).toUpperCase() : "";
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => {
          tick();
          setOpen((v) => !v);
          setSettings(false);
        }}
        aria-label="Your profile"
        aria-expanded={open}
        title={side ? (me?.profile?.name ?? "Your profile") : undefined}
        className={side ? "shell-item flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition hover:bg-paper" : "grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-btn text-btn-ink ring-accent/40 transition hover:opacity-90 hover:ring-2"}
      >
        <Avatar side={side}>
        {me?.profile?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.profile.logo_url} alt="" className="h-full w-full bg-paper-raised object-contain" />
        ) : initial ? (
          <span className="font-serif text-lg leading-none">{initial}</span>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        )}
        </Avatar>
        {side && (
          <span className="shell-label min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{me?.profile?.name ?? "…"}</span>
            <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-ink-soft">{me?.profile ? (me.profile.company ?? ROLE_SHORT[me.profile.role]) : ""}</span>
          </span>
        )}
        {side && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="shell-label shrink-0 text-ink-soft">
            <path d="m7 15 5-5 5 5" />
          </svg>
        )}
      </button>
      {open && (
        <div role="menu" aria-label="Profile" className={`absolute z-[70] w-64 overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-lg ${side ? "bottom-full left-0 mb-2" : "right-0 mt-2"}`}>
          <div className="border-b border-line px-4 py-3">
            {me?.user ? (
              <>
                <p className="flex items-center gap-2">
                  <span className="truncate font-medium">{me.profile?.name ?? me.user.email}</span>
                  {me.profile?.role && <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">{ROLE_SHORT[me.profile.role]}</span>}
                </p>
                <p className="truncate text-xs text-ink-soft">{me.profile?.company ?? me.user.email}</p>
              </>
            ) : (
              <>
                <p className="font-medium">Guest</p>
                <p className="text-xs text-ink-soft">Your projects are saved in this browser. Sign in to keep them anywhere.</p>
              </>
            )}
          </div>
          {!settings ? (
            <ul className="p-1.5 text-sm">
              {projectId && (
                <li>
                  <button
                    role="menuitem"
                    onClick={() => {
                      tick();
                      setOpen(false);
                      setTeam(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-medium hover:bg-paper"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="9" cy="8" r="3.5" />
                      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
                      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
                    </svg>
                    Team on this project
                  </button>
                </li>
              )}
              {me?.user ? (
                <>
                  <li>
                    <a role="menuitem" href="/home" className="block rounded-xl px-3 py-2 hover:bg-paper">
                      Your projects
                    </a>
                  </li>
                  <li>
                    <a role="menuitem" href="/resources" className="block rounded-xl px-3 py-2 hover:bg-paper">
                      Resources and help
                    </a>
                  </li>
                  <li>
                    <a role="menuitem" href="/account" className="block rounded-xl px-3 py-2 hover:bg-paper">
                      Account
                    </a>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <a role="menuitem" href="/login" className="block rounded-xl px-3 py-2 hover:bg-paper">
                      Sign in
                    </a>
                  </li>
                  <li>
                    <a role="menuitem" href="/login?mode=signup" className="block rounded-xl px-3 py-2 font-medium text-accent hover:bg-paper">
                      Create a free account
                    </a>
                  </li>
                </>
              )}
              <li>
                <button role="menuitem" onClick={() => setSettings(true)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-paper">
                  Settings <span aria-hidden className="text-ink-soft">›</span>
                </button>
              </li>
              {me?.user && (
                <li>
                  <button role="menuitem" onClick={signOut} className="w-full rounded-xl px-3 py-2 text-left text-ink-soft hover:bg-paper hover:text-ink">
                    Sign out
                  </button>
                </li>
              )}
            </ul>
          ) : (
            <div className="p-4">
              <button onClick={() => setSettings(false)} className="text-sm text-ink-soft hover:text-ink">
                ‹ Settings
              </button>
              <p className="mt-3 text-xs uppercase tracking-widest text-ink-soft">Appearance</p>
              <div role="radiogroup" aria-label="Appearance" className="mt-2 grid grid-cols-3 gap-1 rounded-full border border-line p-1">
                {(["light", "dark", "system"] as const).map((m) => (
                  <button
                    key={m}
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => choose(m)}
                    className={`rounded-full px-2 py-1.5 text-sm capitalize transition ${mode === m ? "bg-btn text-btn-ink" : "text-ink-soft hover:text-ink"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-ink-soft">Sound effects</p>
                <button
                  role="switch"
                  aria-checked={sound}
                  aria-label="Sound effects"
                  onClick={() => {
                    setSound(!sound);
                    setSoundState(!sound);
                  }}
                  className={`relative h-6 w-11 rounded-full transition ${sound ? "bg-btn" : "bg-line"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper-raised shadow transition-all ${sound ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {projectId && typeof document !== "undefined" && createPortal(<AnimatePresence>{team && <TeamPanel id={projectId} onClose={() => setTeam(false)} />}</AnimatePresence>, document.body)}
    </div>
  );
}
