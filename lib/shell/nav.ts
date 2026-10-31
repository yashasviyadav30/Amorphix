import type { Role } from "../account/roles.ts";
import type { ProjectRole } from "../project/access.ts";
import { tabsFor } from "../project/stage.ts";

// What the sidebar offers each person: their role's tools (each opens on the right, on the home page), and every
// part of the project in front of them, one click away. Safe to import from the browser.

export type Icon =
  | "home" | "wait" | "grid" | "board" | "inbox" | "money" | "today" | "pro" | "upload" | "quiz"
  | "overview" | "style" | "plans" | "cube" | "edit" | "thread" | "site" | "budget" | "shop" | "files" | "team";
export type NavItem = { id: string; label: string; href: string; icon: Icon; count?: number };

export const HOME_TITLE: Record<Role, string> = { owner: "My spaces", architect: "Studio", builder: "Sites" };

/** `runs`: how many started sites this person runs (a builder, or an owner building it themselves). */
export type Counts = { waits: number; requests: number; live: number; fees: number; unread: number; runs?: number };
export type NavGroup = { title: string | null; items: NavItem[] };

/**
 * The role's own tools, grouped the way the work goes. The first group is the daily loop: home, what needs you, what
 * people said. Then the role's work, its money, and what it makes or shows the world. The home link carries the
 * project last opened, so the home page shows it in focus.
 */
export function roleGroups(role: Role, c: Counts, focus: string | null = null, me: string | null = null): NavGroup[] {
  const home: NavItem = { id: "home", label: HOME_TITLE[role], href: focus ? `/home?p=${focus}` : "/home", icon: "home" };
  const waiting: NavItem = { id: "waiting", label: "Waiting on you", href: "/home?view=waiting", icon: "wait", count: c.waits };
  const inbox: NavItem = { id: "inbox", label: "Inbox", href: "/home?view=inbox", icon: "thread", count: c.unread };
  const all: NavItem = { id: "all", label: role === "owner" ? "All my spaces" : "All projects", href: "/home?view=all", icon: "grid" };
  const upload: NavItem = { id: "upload", label: "Upload a plan", href: "/start/plan", icon: "upload" };
  const requests: NavItem = { id: "requests", label: "Requests", href: "/home?view=requests", icon: "inbox", count: c.requests };
  const money = (label: string): NavItem => ({ id: "fees", label, href: "/home?view=fees", icon: "money", count: c.fees });
  const shown = (label: string): NavItem[] => [
    ...(me ? [{ id: "profile", label: "Public profile", href: `/pros/${me}`, icon: "pro" as const }] : []),
    { id: "brand", label, href: "/account", icon: "style" },
  ];
  // running a site: the crew's week, what's on order, and what each site has cost
  const site: NavItem[] = [
    { id: "crew", label: "Crew & wages", href: "/home?view=crew", icon: "team" },
    { id: "deliveries", label: "Materials & deliveries", href: "/home?view=deliveries", icon: "shop" },
    { id: "money", label: "Site money", href: "/home?view=money", icon: "budget" },
  ];
  if (role === "architect")
    return [
      { title: null, items: [home, waiting, inbox] },
      { title: "Clients", items: [{ id: "pipeline", label: "Pipeline", href: "/home?view=pipeline", icon: "board" }, requests, all] },
      { title: "Money", items: [money("Fee ledger")] },
      { title: "Studio", items: [...shown("Studio branding"), upload] },
    ];
  if (role === "builder")
    return [
      { title: null, items: [home, { id: "today", label: "Today on site", href: "/home?view=today", icon: "today", count: c.live }, waiting, inbox] },
      { title: "Site work", items: [site[0], site[1], requests, all] },
      { title: "Money", items: [site[2], money("Fees & payments")] },
      { title: "Company", items: [...shown("Company branding"), upload] },
    ];
  return [
    { title: null, items: [home, waiting, inbox] },
    { title: "Spaces", items: [all, money("Payments")] },
    ...(c.runs ? [{ title: "Your build", items: site }] : []),
    { title: "Create", items: [upload, { id: "quiz", label: "Find your style", href: "/quiz", icon: "quiz" }] },
    { title: "People", items: [{ id: "pros", label: "Find a pro", href: "/pros", icon: "pro" }] },
  ];
}

export type NavProject = { id: string; role: ProjectRole; status: string; mode: string; chosen: boolean; toured: boolean; unlocked: boolean; unread: number };

/**
 * Every part of one project this person can open. The tabs (overview, thread, site) live on the project home, which an
 * owner reaches after the guided tour; parts that need a chosen plan wait for one, as the tour does.
 */
export function projectTools(p: NavProject): NavItem[] {
  const at = `/project/${p.id}`;
  if (p.status === "interview") return [{ id: "overview", label: "Overview", href: at, icon: "overview" }];
  const home = p.role !== "owner" || p.toured || p.mode === "pro";
  const tabs = tabsFor(p.role, true);
  const has = (id: string) => tabs.some((t) => t.id === id);
  const step = (id: string) => tabs.some((t) => t.steps.includes(id));
  const out: NavItem[] = [];
  if (home) out.push({ id: "overview", label: "Overview", href: `${at}?tab=overview`, icon: "overview" });
  out.push({ id: "brief", label: "Style", href: `${at}?step=brief`, icon: "style" }, { id: "plans", label: "Plans", href: `${at}?step=plans`, icon: "plans" });
  if (p.chosen) {
    out.push({ id: "walkthrough", label: "3D walkthrough", href: `${at}?step=walkthrough`, icon: "cube" });
    // the guided tour has no unlock card of its own, so Make changes shows there only once it's open
    if (step("workspace") && (home || p.unlocked)) out.push({ id: "workspace", label: "Make changes", href: `${at}?step=workspace`, icon: "edit" });
  }
  if (home) out.push({ id: "thread", label: "Thread", href: `${at}?tab=thread`, icon: "thread", count: p.unread });
  if (home && has("site")) out.push({ id: "site", label: "Site", href: `${at}?tab=site`, icon: "site" });
  if (p.chosen && step("budget")) out.push({ id: "budget", label: "Budget", href: `${at}?step=budget`, icon: "budget" }, { id: "shop", label: "Shopping list", href: `${at}?step=shop`, icon: "shop" });
  if (p.chosen && step("drawings")) out.push({ id: "drawings", label: "Drawings & files", href: `${at}?step=drawings`, icon: "files" });
  if (p.role !== "viewer") out.push({ id: "team", label: "Team", href: "#team", icon: "team" });
  return out;
}

/** Which item a URL is on: a home view, or a project part. */
export function activeId(pathname: string, params: { get(k: string): string | null }): string {
  if (pathname === "/home") return params.get("view") ?? "home";
  if (pathname.startsWith("/project/")) return params.get("step") ?? params.get("tab") ?? "overview";
  if (pathname === "/pros") return "pros";
  if (pathname.startsWith("/pros/")) return "profile";
  if (pathname === "/account") return "brand";
  return "";
}
