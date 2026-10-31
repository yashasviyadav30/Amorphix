"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { tick, transition } from "@/components/fx/sfx";
import { matches, type PaletteItem } from "@/lib/home/palette";
import { openPart } from "@/components/shell/part";

// Ctrl+K (⌘K on a Mac): jump anywhere. Every project and each of its parts (style, plans, 3D, budget, thread,
// site, files), and the app's own pages. Type a few letters of any of it; arrows and Enter, or tap.

type Item = PaletteItem;

const PAGES: Item[] = [
  { label: "New design", hint: "Start", href: "/start", group: "Go to" },
  { label: "Upload a plan", hint: "Start", href: "/start/plan", group: "Go to" },
  { label: "My projects", hint: "Home", href: "/home", group: "Go to" },
  { label: "Find your style", hint: "Quiz", href: "/quiz", group: "Go to" },
  { label: "Resources and help", hint: "Docs", href: "/resources", group: "Go to" },
  { label: "Account", hint: "Settings", href: "/account", group: "Go to" },
  { label: "Plans and pricing", hint: "Pricing", href: "/?site#pricing", group: "Go to" },
];

const PARTS: [string, string][] = [
  ["Your style", "?step=brief"],
  ["Plans", "?step=plans"],
  ["3D walkthrough", "?step=walkthrough"],
  ["Budget", "?step=budget"],
  ["Shopping list", "?step=shop"],
  ["Thread", "?tab=thread"],
  ["Site", "?tab=site"],
  ["Files and drawings", "?step=drawings"],
];

export function CommandPalette({ variant = "header" }: { variant?: "header" | "bar" } = {}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const [projects, setProjects] = useState<{ id: string; name: string }[] | null>(null);
  const [mac, setMac] = useState(false);
  const router = useRouter();
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setMac(/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent));
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  useEffect(() => {
    if (!open) return;
    tick();
    setQ("");
    setAt(0);
    if (!projects)
      fetch("/api/palette")
        .then((r) => (r.ok ? r.json() : { projects: [] }))
        .then((d) => setProjects(d.projects ?? []))
        .catch(() => setProjects([]));
  }, [open, projects]);

  const items = useMemo(() => {
    const own: Item[] = (projects ?? []).flatMap((p) => [
      { label: p.name, hint: "Project", href: `/project/${p.id}`, group: "Projects" },
      ...PARTS.map(([part, q]) => ({ label: `${p.name} › ${part}`, hint: part, href: `/project/${p.id}${q}`, group: "Projects" })),
    ]);
    // with nothing typed, each project once, then the pages
    const all = q.trim() ? [...own, ...PAGES] : [...own.filter((i) => i.hint === "Project").slice(0, 6), ...PAGES];
    return matches(all, q).slice(0, 40);
  }, [projects, q]);

  const go = (it: Item) => {
    transition();
    setOpen(false);
    openPart(router, it.href);
  };

  useEffect(() => {
    list.current?.querySelector(`[data-i="${at}"]`)?.scrollIntoView({ block: "nearest" });
  }, [at]);

  return (
    <>
      {variant === "bar" ? (
        // the signed-in app's top bar: a search field on wide screens, an icon on a phone
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search and jump"
          title={`Search and jump (${mac ? "⌘" : "Ctrl+"}K)`}
          className="shell-item flex h-9 items-center gap-2.5 rounded-full border border-line bg-paper-raised/80 px-2.5 text-sm text-ink-soft transition hover:border-accent/60 hover:text-accent sm:w-64 sm:px-3.5 lg:w-80"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="hidden truncate sm:inline">Search projects, plans, threads…</span>
          <kbd className="ml-auto hidden rounded border border-line px-1.5 font-mono text-[10px] sm:inline">{mac ? "⌘K" : "Ctrl K"}</kbd>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search and jump"
          title={`Search and jump (${mac ? "⌘" : "Ctrl+"}K)`}
          className="flex h-9 items-center gap-2 rounded-full border border-line bg-paper-raised/80 px-2.5 text-sm text-ink-soft transition hover:border-accent/60 hover:text-accent sm:px-3"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <kbd className="hidden font-mono text-[11px] lg:inline">{mac ? "⌘K" : "Ctrl K"}</kbd>
        </button>
      )}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-ink/30 px-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
                <motion.div
                  role="dialog"
                  aria-modal
                  aria-label="Search and jump"
                  initial={{ y: -10, scale: 0.98 }}
                  animate={{ y: 0, scale: 1 }}
                  exit={{ y: -10, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-[0_30px_90px_-30px_var(--accent)]"
                >
                  {/* a scan line under the box as it opens */}
                  <motion.span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" initial={{ opacity: 1, scaleX: 0 }} animate={{ opacity: 0, scaleX: 1 }} transition={{ duration: 0.7 }} />
                  <div className="flex items-center gap-3 border-b border-line px-4">
                    <span className="font-mono text-accent">&gt;</span>
                    <input
                      autoFocus
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setAt(0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") (e.preventDefault(), setAt((i) => Math.min(i + 1, items.length - 1)));
                        else if (e.key === "ArrowUp") (e.preventDefault(), setAt((i) => Math.max(i - 1, 0)));
                        else if (e.key === "Enter" && items[at]) go(items[at]);
                        else if (e.key === "Escape") setOpen(false);
                      }}
                      placeholder="Jump to a project, a room's budget, the thread…"
                      aria-label="Search"
                      className="w-full bg-transparent py-4 outline-none placeholder:text-ink-soft/70"
                    />
                    <kbd className="font-mono text-[10px] text-ink-soft">esc</kbd>
                  </div>
                  <ul ref={list} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
                    {projects === null && <li className="px-3 py-2 font-mono text-xs text-ink-soft">&gt; loading your projects…</li>}
                    {items.map((it, i) => (
                      <li key={it.href + it.label} data-i={i} role="option" aria-selected={i === at}>
                        {(i === 0 || items[i - 1].group !== it.group) && <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">{it.group}</p>}
                        <button
                          type="button"
                          onMouseEnter={() => setAt(i)}
                          onClick={() => go(it)}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm ${i === at ? "bg-accent/10 text-accent" : ""}`}
                        >
                          <span className="truncate">{it.label}</span>
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-soft">{it.hint}</span>
                        </button>
                      </li>
                    ))}
                    {projects !== null && !items.length && <li className="px-3 py-6 text-center text-sm text-ink-soft">Nothing called that. Try a project or a page.</li>}
                  </ul>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
