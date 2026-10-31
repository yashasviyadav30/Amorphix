"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { tick, transition } from "./fx/sfx";
import { openPart } from "./shell/part";

type Event = { id: number; project_id: string | null; kind: string; data: { by?: string; text?: string; project?: string | null; room?: string | null }; read: boolean; created_at: string };

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

// What each kind of notification looks like, and where opening it goes on its project.
const KINDS: Record<string, { mark: string; tone: string; to: string }> = {
  message: { mark: "Msg", tone: "text-accent bg-accent/10", to: "?tab=thread" },
  review: { mark: "Rev", tone: "text-accent bg-accent/10", to: "?tab=thread" },
  approved: { mark: "✓", tone: "text-leaf bg-leaf/10", to: "?tab=thread" },
  changes: { mark: "Chg", tone: "text-amber-600 bg-amber-500/10", to: "?tab=thread" },
  fee: { mark: "$", tone: "text-leaf bg-leaf/10", to: "?tab=overview" },
  site: { mark: "Site", tone: "text-leaf bg-leaf/10", to: "?tab=site" },
  joined: { mark: "+", tone: "text-ink-soft bg-paper", to: "?tab=thread" },
  answered: { mark: "Ans", tone: "text-accent bg-accent/10", to: "?tab=overview" },
  handover: { mark: "Hand", tone: "text-accent bg-accent/10", to: "?tab=thread" },
  chose: { mark: "Plan", tone: "text-accent bg-accent/10", to: "?step=plans" },
  changed: { mark: "Edit", tone: "text-accent bg-accent/10", to: "?step=walkthrough" },
  accepted: { mark: "Yes", tone: "text-leaf bg-leaf/10", to: "?tab=overview" },
  change: { mark: "Δ", tone: "text-amber-600 bg-amber-500/10", to: "?tab=thread" },
  movein: { mark: "Key", tone: "text-leaf bg-leaf/10", to: "?tab=site" },
  request: { mark: "Ask", tone: "text-accent bg-accent/10", to: "?tab=overview" },
  rated: { mark: "★", tone: "text-amber-600 bg-amber-500/10", to: "?tab=site" },
  quote: { mark: "Quote", tone: "text-accent bg-accent/10", to: "?tab=site" },
  visit: { mark: "Visit", tone: "text-leaf bg-leaf/10", to: "?tab=site" },
  signoff: { mark: "✓", tone: "text-leaf bg-leaf/10", to: "?tab=site" },
  declined: { mark: "No", tone: "text-ink-soft bg-paper", to: "?tab=overview" },
};
const kindOf = (k: string) => KINDS[k] ?? { mark: "•", tone: "text-ink-soft bg-paper", to: "?tab=thread" };
const today = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

// The bell: what happened on your projects. Opening the list only shows it; each one is marked read when it's opened
// (or ticked), or all at once. Shown only when signed in.
// ponytail: checks every 30 seconds; Supabase realtime can replace the polling later.
export function NotificationBell() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [only, setOnly] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(
    () =>
      fetch("/api/events")
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => {
          if (!b) return setEvents(null);
          setEvents(b.events);
          setUnread(b.unread);
        })
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

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

  const markRead = (ids: number[] | null) => {
    const hit = (e: Event) => !e.read && (!ids || ids.includes(e.id));
    const n = events?.filter(hit).length ?? 0;
    if (!n) return;
    setEvents((list) => list?.map((e) => (hit(e) ? { ...e, read: true } : e)) ?? null);
    setUnread((u) => (ids ? Math.max(0, u - n) : 0));
    void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ids ? { ids } : {}) });
  };

  const openOne = (e: Event) => {
    transition();
    markRead([e.id]);
    setOpen(false);
    if (!e.project_id) return router.push("/home");
    openPart(router, `/project/${e.project_id}${kindOf(e.kind).to}`);
  };

  if (!events) return null;
  const shown = only ? events.filter((e) => !e.read) : events;
  const groups: [string, Event[]][] = [
    ["Today", shown.filter((e) => today(e.created_at))],
    ["Earlier", shown.filter((e) => !today(e.created_at))],
  ];

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        aria-expanded={open}
        onClick={() => {
          tick();
          setOpen((v) => !v);
        }}
        className={`relative grid h-9 w-9 place-items-center rounded-full border transition hover:border-accent ${open ? "border-accent text-accent" : "border-line"}`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={unread ? "origin-top animate-[bell_2.4s_ease-in-out_1]" : ""}>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] text-white shadow-[0_0_8px_var(--accent)]">{unread > 9 ? "9+" : unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-[0_24px_70px_-30px_var(--accent)]"
          >
            <motion.span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" initial={{ opacity: 1, scaleX: 0 }} animate={{ opacity: 0, scaleX: 1 }} transition={{ duration: 0.7 }} />
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <p className="font-medium">Notifications</p>
              {unread > 0 && <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">{unread} new</span>}
              <button type="button" onClick={() => (tick(), markRead(null))} disabled={!unread} className="ml-auto text-xs text-accent hover:underline disabled:text-ink-soft/50 disabled:no-underline">
                Mark all read
              </button>
            </div>
            <div role="tablist" aria-label="Show" className="flex gap-1 border-b border-line px-3 py-2 font-mono text-[11px] uppercase tracking-wider">
              {[
                [false, "All"],
                [true, "Unread"],
              ].map(([v, label]) => (
                <button key={String(label)} role="tab" aria-selected={only === v} onClick={() => (tick(), setOnly(v as boolean))} className={`rounded-full px-3 py-1 transition ${only === v ? "bg-btn text-btn-ink" : "text-ink-soft hover:text-ink"}`}>
                  {label as string}
                </button>
              ))}
            </div>
            {shown.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-soft">{only ? "✓ You're all caught up." : "Nothing yet. Messages and updates on your projects show here."}</p>
            ) : (
              <div className="max-h-[26rem] overflow-y-auto">
                {groups.map(([label, list]) =>
                  list.length ? (
                    <div key={label}>
                      <p className="sticky top-0 z-10 bg-paper-raised/95 px-4 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft backdrop-blur">{label}</p>
                      <ul>
                        {list.map((e) => (
                          <li key={e.id} className={`group relative flex items-start gap-3 px-4 py-2.5 transition hover:bg-paper ${e.read ? "" : "bg-accent/[0.04]"}`}>
                            <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-[10px] ${kindOf(e.kind).tone}`}>{kindOf(e.kind).mark}</span>
                            <button type="button" onClick={() => openOne(e)} className="min-w-0 flex-1 text-left">
                              <span className="flex justify-between gap-2 text-xs text-ink-soft">
                                <span className="truncate">{e.data.project ?? "Your project"}{e.data.room ? ` · ${e.data.room}` : ""}</span>
                                <span className="shrink-0 font-mono">{ago(e.created_at)}</span>
                              </span>
                              <span className={`mt-0.5 line-clamp-2 text-sm ${e.read ? "text-ink-soft" : "text-ink"}`}>{e.kind === "message" ? `${e.data.by}: ${e.data.text}` : e.data.text}</span>
                            </button>
                            {!e.read && (
                              <button type="button" onClick={() => (tick(), markRead([e.id]))} title="Mark read" aria-label="Mark read" className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full">
                                <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_6px_var(--accent)] group-hover:hidden" />
                                <span className="hidden text-xs text-accent group-hover:block">✓</span>
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
