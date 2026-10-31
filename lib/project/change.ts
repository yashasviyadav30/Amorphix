import { supabaseAdmin } from "../supabase/admin.ts";
import { estimate, marketOf, money, type Market } from "../budget/costs.ts";
import { newBuildOf, tierOf } from "../site/store.ts";
import type { Layout } from "../layout/schema.ts";
import type { Project } from "./store.ts";

// Change requests: once a design is approved, a change to it is a request, not a fact. It shows what changed and what
// it does to the cost, and waits for whoever approves the design; approved, it's what gets built; declined, the
// design goes back to the approved version. The build carries on either way. (Vicky, 16 Oct.)

/** Stages where a change to the design is a request. After move-in, nothing changes. */
export const LOCKED = ["approved", "building"] as const;
export const isLocked = (status: string) => (LOCKED as readonly string[]).includes(status);

/** "+$3.2K", "−$800", or no change, in the market's own money. */
export function deltaText(delta: number, m: Market): string {
  if (Math.abs(delta) < 1) return "no change to the cost";
  return `${delta > 0 ? "+" : "−"}${money(Math.abs(delta), m)}`;
}

/** What a change does to the cost: the middle of the estimate after, less the middle before. */
export function costDelta(before: Layout, after: Layout, p: Pick<Project, "interview" | "site">): { delta: number; text: string } {
  const market = marketOf(p.site?.location);
  const mid = (l: Layout) => {
    const e = estimate(l, tierOf(p as Project), market, newBuildOf(p as Project), p.site?.location);
    return (e.total.low + e.total.high) / 2;
  };
  const delta = Math.round(mid(after) - mid(before));
  return { delta, text: deltaText(delta, market) };
}

export type PendingChange = { from: number; to: number; notes: string[]; delta: number; text: string; approved: Layout };

const db = () => supabaseAdmin();

/** The version last approved, or null if none was. */
export async function approvedVersion(projectId: string): Promise<number | null> {
  const { data } = await db().from("approvals").select("version").eq("project_id", projectId).eq("decision", "approved").order("created_at", { ascending: false }).limit(1);
  return (data?.[0]?.version as number | undefined) ?? null;
}

/** The change waiting for approval on a locked design: every version since the approved one, and its cost. */
export async function pendingChange(p: Project): Promise<PendingChange | null> {
  if (!isLocked(p.status)) return null;
  const from = await approvedVersion(p.id);
  if (from === null) return null;
  const { data } = await db().from("project_versions").select("version, note, layout").eq("project_id", p.id).gte("version", from).order("version");
  const rows = (data ?? []) as { version: number; note: string; layout: Layout }[];
  const approved = rows.find((r) => r.version === from);
  const latest = rows.at(-1);
  if (!approved || !latest || latest.version === from) return null;
  return { from, to: latest.version, notes: rows.filter((r) => r.version > from).map((r) => r.note), approved: approved.layout, ...costDelta(approved.layout, latest.layout, p) };
}
