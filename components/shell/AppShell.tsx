"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Mark } from "@/components/Logo";
import { ProfileMenu } from "@/components/ProfileMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { InstallApp } from "@/components/InstallApp";
import { CommandPalette } from "@/components/CommandPalette";
import { NewClient } from "@/components/account/NewClient";
import { TeamPanel } from "@/components/project/TeamPanel";
import { Decode } from "@/components/fx/Decode";
import { tick, whoosh } from "@/components/fx/sfx";
import { announcePart } from "./part";
import { activeId, HOME_TITLE, projectTools, roleGroups, type Icon, type NavItem } from "@/lib/shell/nav";
import { STAGES } from "@/lib/project/stage";
import { ROLE_NAME } from "@/lib/project/access";
import { statusLine } from "@/lib/home/waiting";
import type { Shell, ShellProject } from "@/lib/shell/data";

// The signed-in app: a sidebar on the left with this person's tools, the project in front of them and every project
// they're on, and the page on the right. The sidebar folds to a rail of icons (Ctrl+B, remembered), and on a phone it
// slides in from the menu button. Pages inside it drop their own header (see SiteHeader).

const InShell = createContext(false);
export const useInShell = () => useContext(InShell);

/** Ask the sidebar to fetch its counts and projects again (after a project is added or deleted). */
export const refreshShell = () => window.dispatchEvent(new Event("amorphix:shell"));

const LAST = "amorphix-last";
const RAIL = "amorphix-rail";

const PATHS: Record<Icon, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  wait: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  board: (
    <>
      <rect x="3" y="4" width="5" height="16" rx="1.2" />
      <rect x="9.5" y="4" width="5" height="11" rx="1.2" />
      <rect x="16" y="4" width="5" height="7" rx="1.2" />
    </>
  ),
  inbox: <path d="M3 13h5l1.5 3h5L16 13h5M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" />,
  money: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  today: <path d="M2 20h20M4 20V10l5-3v13M9 20V5l7 4v11M16 20v-7l4 2v5M6.5 13h0M12 12h0M12 15.5h0" />,
  pro: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11l1.6 1.6L22 9.2" />
    </>
  ),
  upload: <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />,
  quiz: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
  overview: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M3.5 9.5h17M9.5 9.5v11" />
    </>
  ),
  style: <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.3-1-1.5-1-2.7 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3zM7.5 11.5h0M10 7.5h0M14.5 7.5h0" />,
  plans: <path d="M3.5 4.5h17v15h-17zM3.5 11h7v8.5M10.5 4.5V8M14 11h6.5M14 11v3" />,
  cube: <path d="M12 2.8 20.5 7.5v9L12 21.2 3.5 16.5v-9zM12 21.2V12M3.5 7.5 12 12l8.5-4.5" />,
  edit: <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-4-4L4 16zM13.5 6.5l4 4" />,
  thread: <path d="M4 5h16v11H9l-5 4z" />,
  site: <path d="M3 21h18M5 21V11l7-6 7 6v10M9.5 21v-6h5v6M2 12l10-8.5L22 12" />,
  budget: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  shop: <path d="M5 8h14l-1.2 12H6.2zM9 8V6.5a3 3 0 0 1 6 0V8" />,
  files: <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 16.5h6" />,
  team: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
    </>
  ),
};

function Glyph({ icon, className = "" }: { icon: Icon; className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`shrink-0 ${className}`}>
      {PATHS[icon]}
    </svg>
  );
}

// A project's mark: the first letter of its kind of space, coloured by where it stands.
const KIND: Record<string, string> = { house: "H", apartment: "A", studio: "S", cafe: "C", office: "O", shop: "R", hotel: "Ho" };
function ProjectMark({ p }: { p: ShellProject }) {
  const tone = p.stage >= 4 ? "border-leaf/50 text-leaf bg-leaf/10" : p.stage >= 2 ? "border-accent/50 text-accent bg-accent/10" : "border-line text-ink-soft bg-paper";
  return <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border font-mono text-[10px] ${tone}`}>{KIND[p.space_type ?? ""] ?? "P"}</span>;
}

function Count({ n, tone = "bg-accent text-white" }: { n?: number; tone?: string }) {
  if (!n) return null;
  return <span className={`shell-label ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 font-mono text-[10px] ${tone}`}>{n > 99 ? "99+" : n}</span>;
}

function Item({ item, active, onAction }: { item: NavItem; active: boolean; onAction?: () => void }) {
  const body = (
    <>
      <span className="relative">
        <Glyph icon={item.icon} className={active ? "text-accent" : ""} />
        {/* in the rail, a dot stands in for the count */}
        {!!item.count && <span className="shell-only-rail absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent shadow-[0_0_6px_var(--accent)]" />}
      </span>
      <span className="shell-label truncate">{item.label}</span>
      <Count n={item.count} />
    </>
  );
  const cls = `shell-item flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] transition ${active ? "bg-accent/10 font-medium text-ink" : "text-ink-soft hover:bg-paper hover:text-ink"}`;
  if (onAction)
    return (
      <button type="button" title={item.label} onClick={() => (tick(), onAction())} className={cls}>
        {body}
      </button>
    );
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={active ? "page" : undefined}
      onClick={() => {
        tick();
        announcePart(item.href);
      }}
      className={cls}
    >
      {body}
    </Link>
  );
}

function Section({ title, children }: { title: string | null; children: ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      {title && (
        <p className="shell-label mb-1 px-3 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft/80">
          <span className="text-accent/70">{"// "}</span>
          {title}
        </p>
      )}
      {title && <span aria-hidden className="shell-only-rail mx-auto mb-2 block h-px w-6 bg-line" />}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  // The query as it really stands: links change it through the router, the project page rewrites it in place.
  const [qs, setQs] = useState(() => search.toString());
  useEffect(() => setQs(search.toString()), [search]);
  useEffect(() => {
    const sync = () => setQs(location.search.slice(1));
    window.addEventListener("amorphix:url", sync);
    return () => window.removeEventListener("amorphix:url", sync);
  }, []);
  const params = useMemo(() => new URLSearchParams(qs), [qs]);
  const [shell, setShell] = useState<Shell | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [team, setTeam] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const projectId = pathname.match(/^\/project\/([0-9a-f-]{36})/)?.[1] ?? null;
  const onHome = pathname === "/home";

  const load = useCallback(() => {
    setLoading(true);
    return fetch("/api/shell")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b?.shell && setShell(b.shell))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fresh counts when the project changes, on coming back home, when the window is back in front, and when asked.
  useEffect(() => {
    void load();
  }, [load, projectId, onHome]);
  useEffect(() => {
    const again = () => void load();
    window.addEventListener("focus", again);
    window.addEventListener("amorphix:shell", again);
    return () => {
      window.removeEventListener("focus", again);
      window.removeEventListener("amorphix:shell", again);
    };
  }, [load]);

  // The project last opened stays in focus on the home page.
  useEffect(() => {
    try {
      if (projectId) localStorage.setItem(LAST, projectId);
      setLast(projectId ?? localStorage.getItem(LAST));
    } catch {}
  }, [projectId]);

  // The drawer closes once a link in it is followed.
  useEffect(() => setDrawer(false), [pathname, search]);

  // Ctrl+B (⌘B) folds the sidebar to its rail and back; not while typing.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "b" || t?.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      fold();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const projects = useMemo(() => {
    if (!shell) return [];
    // a builder's live sites lead
    const list = shell.role === "builder" ? [...shell.projects].sort((a, b) => Number(b.status === "building") - Number(a.status === "building")) : shell.projects;
    const q = filter.trim().toLowerCase();
    return q ? list.filter((p) => p.name.toLowerCase().includes(q) || (p.owner ?? "").toLowerCase().includes(q)) : list;
  }, [shell, filter]);

  const known = (id: string | null) => (id && shell?.projects.find((p) => p.id === id)) || null;
  // the project in front of this person: the one open, or on the home page the one in focus
  const current = known(projectId) || (onHome ? known(params.get("p")) || known(last) || shell?.projects[0] || null : null);
  const active = activeId(pathname, params);
  const role = shell?.role ?? "owner";
  const groups = shell ? roleGroups(role, shell.counts, current?.id ?? null, role === "owner" ? null : shell.me) : [];
  const line = shell ? statusLine(shell.projects.map((p) => STAGES[p.stage].label), shell.counts.waits) : "loading";
  const listTitle = role === "architect" ? "Clients" : role === "builder" ? "Projects" : "Your spaces";
  const part = projectId && current ? projectTools(current).find((t) => t.id === active)?.label : groups.flatMap((g) => g.items).find((t) => t.id === active && t.id !== "home")?.label;

  const side = (
    <aside
      aria-label="Amorphix"
      className={`shell-side fixed inset-y-0 left-0 z-[60] flex flex-col border-r border-line bg-paper-raised/95 backdrop-blur transition-[transform,width] duration-300 lg:sticky lg:top-0 lg:z-30 lg:h-dvh lg:translate-x-0 ${drawer ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
    >
      {/* a faint blueprint grid, fading down */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] [background-image:linear-gradient(var(--accent)_1px,transparent_1px),linear-gradient(90deg,var(--accent)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />
      <div className="flex items-center gap-2 px-3 pb-2 pt-4">
        <Link href={current ? `/home?p=${current.id}` : "/home"} onClick={() => tick()} className="flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1" title="Home">
          <Mark size={26} />
          <span className="shell-label font-serif text-2xl leading-none">Amorphix</span>
        </Link>
        <button type="button" onClick={fold} title="Fold the sidebar (Ctrl+B)" aria-label="Fold the sidebar" className="shell-label ml-auto hidden h-8 w-8 place-items-center rounded-lg text-ink-soft transition hover:bg-paper hover:text-accent lg:grid">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <rect x="3.5" y="4" width="17" height="16" rx="2" />
            <path d="M9.5 4v16M15.5 10l-2 2 2 2" />
          </svg>
        </button>
        <button type="button" onClick={() => setDrawer(false)} aria-label="Close the menu" className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-paper lg:hidden">
          ✕
        </button>
      </div>
      {/* in the rail, the open button sits under the mark */}
      <button type="button" onClick={fold} title="Open the sidebar (Ctrl+B)" aria-label="Open the sidebar" className="shell-only-rail mx-auto mb-1 hidden h-8 w-8 place-items-center rounded-lg text-ink-soft transition hover:bg-paper hover:text-accent lg:grid">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <rect x="3.5" y="4" width="17" height="16" rx="2" />
          <path d="M9.5 4v16M13.5 10l2 2-2 2" />
        </svg>
      </button>

      <div className="px-3 pb-3">
        {role === "owner" ? (
          <Link href="/start" onClick={() => tick()} title="New design" className="glow-btn flex w-full rounded-xl px-3 py-2.5 text-sm">
            <span aria-hidden>+</span>
            <span className="shell-label">New design</span>
          </Link>
        ) : (
          <NewClient
            className="glow-btn flex w-full rounded-xl px-3 py-2.5 text-sm"
            label={
              <>
                <span aria-hidden>+</span>
                <span className="shell-label">New client</span>
              </>
            }
          />
        )}
      </div>

      <nav aria-label="Your tools" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 [scrollbar-width:thin]">
        {!shell
          ? Array.from({ length: 7 }, (_, i) => <span key={i} className="mb-2 block h-8 animate-pulse rounded-xl bg-line/50" />)
          : groups.map((g, i) => (
              <Section key={g.title ?? i} title={g.title}>
                {g.items.map((it) => (
                  <Item key={it.id} item={it} active={active === it.id && (it.id !== "home" || onHome)} />
                ))}
              </Section>
            ))}

        {shell && shell.projects.length > 0 && (
          <Section title={`${listTitle} · ${shell.projects.length}`}>
            {shell.projects.length > 6 && (
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" aria-label={`Filter ${listTitle.toLowerCase()}`} className="shell-label mb-1 w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 font-mono text-xs outline-none focus:border-accent" />
            )}
            {projects.map((p) => (
              <div key={p.id}>
              <Link
                href={`/project/${p.id}`}
                title={p.name}
                aria-current={projectId === p.id ? "page" : undefined}
                onClick={() => tick()}
                className={`shell-item flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition ${projectId === p.id ? "bg-accent/10" : "hover:bg-paper"}`}
              >
                <span className="relative">
                  <ProjectMark p={p} />
                  {p.unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent shadow-[0_0_6px_var(--accent)]" />}
                </span>
                <span className="shell-label min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{p.name}</span>
                  <span className="block truncate font-mono text-[10px] text-ink-soft">
                    {STAGES[p.stage].label}
                    {p.owner && ` · ${p.owner.split(" ")[0]}`}
                  </span>
                </span>
                {p.status === "building" && <span className="shell-label h-1.5 w-1.5 animate-pulse rounded-full bg-leaf" title="Building now" />}
                {current?.id === p.id && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden className="shell-label shrink-0 text-accent">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                )}
              </Link>
              {/* the project in front of you opens out into its parts, one click each */}
              {current?.id === p.id && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="shell-label ml-[1.15rem] mt-0.5 space-y-0.5 overflow-hidden border-l border-accent/30 pb-1 pl-2">
                  <p className="px-3 pb-0.5 pt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-accent/80">
                    {projectId ? "open now" : "in focus"}
                    {p.role !== "owner" && <span className="normal-case tracking-normal text-ink-soft"> · you&apos;re the {ROLE_NAME[p.role].toLowerCase()}</span>}
                  </p>
                  {projectTools(p).map((it) => (
                    <Item key={it.id} item={it} active={!!projectId && active === it.id} onAction={it.id === "team" ? () => setTeam(p.id) : undefined} />
                  ))}
                </motion.div>
              )}
              </div>
            ))}
            {!projects.length && <p className="shell-label px-3 py-2 text-xs text-ink-soft">Nothing called that.</p>}
          </Section>
        )}
      </nav>

      <div className="border-t border-line px-3 pb-3 pt-2">
        <p className="shell-label truncate px-1 pb-2 font-mono text-[10px] text-ink-soft" title={line}>
          <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${loading ? "animate-pulse bg-accent" : "bg-leaf"}`} />
          {line}
        </p>
        <ProfileMenu placement="sidebar" />
      </div>
    </aside>
  );

  return (
    <InShell.Provider value={true}>
      <div className="flex w-full flex-1">
        {side}
        <AnimatePresence>
          {drawer && <motion.div key="veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} className="fixed inset-0 z-[55] bg-ink/30 backdrop-blur-sm lg:hidden" />}
        </AnimatePresence>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 px-4 py-3 sm:px-6">
            <button type="button" onClick={() => (whoosh(), setDrawer(true))} aria-label="Open the menu" className="grid h-9 w-9 place-items-center rounded-lg border border-line lg:hidden">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </button>
            {/* where you are: the home, the project, the part */}
            <p className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              <span className="text-accent">&gt;</span>
              <Link href="/home" className="shrink-0 hover:text-accent">
                {HOME_TITLE[role]}
              </Link>
              {projectId && current && (
                <>
                  <span>/</span>
                  <Link href={`/project/${current.id}`} className="truncate normal-case tracking-normal text-ink hover:text-accent">
                    {current.name}
                  </Link>
                </>
              )}
              {part && (
                <>
                  <span>/</span>
                  <span className="truncate text-ink">
                    <Decode key={part} text={part} speed={20} />
                  </span>
                </>
              )}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <CommandPalette variant="bar" />
              <InstallApp />
              <NotificationBell />
            </div>
          </header>
          {children}
        </div>
      </div>
      {team && typeof document !== "undefined" && createPortal(<AnimatePresence>{team && <TeamPanel id={team} onClose={() => setTeam(null)} />}</AnimatePresence>, document.body)}
    </InShell.Provider>
  );
}

function fold() {
  whoosh();
  const root = document.documentElement;
  const rail = root.dataset.rail !== "1";
  if (rail) root.dataset.rail = "1";
  else delete root.dataset.rail;
  try {
    localStorage.setItem(RAIL, rail ? "1" : "0");
  } catch {}
}
