import { supabaseAdmin } from "../supabase/admin.ts";
import type { ProjectRole } from "./access.ts";

// The builder's quote: their own price for the build, which whoever approves the design accepts or declines. Until
// one is accepted, the site's budget is Amorphix's estimate; after, it's the quote. A builder can send a new quote any
// time (a changed design, a better price); only the latest counts. (Flow audit item 10.)

export type QuoteStatus = "sent" | "accepted" | "declined" | "withdrawn";
export type Quote = {
  id: number;
  amount: number;
  currency: string;
  weeks: number | null;
  note: string | null;
  status: QuoteStatus;
  created_at: string;
  answered_at: string | null;
  builder: string;
};

/** Who prices the build: the builder on the project, or a builder whose own project it is (design-and-build). */
export const canSendQuote = (role: ProjectRole, ownerKind: string | null) => role === "builder" || (role === "owner" && ownerKind === "builder");

/** How a quote sits against Amorphix's estimate, in words: "within Amorphix's estimate", "12% above Amorphix's estimate". */
export function againstEstimate(amount: number, low: number, high: number): { side: "below" | "within" | "above"; text: string } {
  if (amount < low) return { side: "below", text: `${Math.round(((low - amount) / low) * 100)}% below Amorphix's estimate` };
  if (amount > high) return { side: "above", text: `${Math.round(((amount - high) / high) * 100)}% above Amorphix's estimate` };
  return { side: "within", text: "within Amorphix's estimate" };
}

/** The site's budget: an accepted quote is the price; otherwise the estimate's range. */
export function siteBudget(estimate: { low: number; high: number } | null, accepted: Pick<Quote, "amount"> | null): { low: number; high: number } | null {
  if (accepted) return { low: accepted.amount, high: accepted.amount };
  return estimate;
}

const db = () => supabaseAdmin();

/** The project's latest quote (any status), with the builder's name. */
export async function latestQuote(projectId: string): Promise<Quote | null> {
  const { data } = await db().from("quotes").select("id, amount, currency, weeks, note, status, created_at, answered_at, builder_id").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const { data: who } = await db().from("profiles").select("name, company").eq("user_id", data.builder_id).maybeSingle();
  const { builder_id: _b, ...q } = data as typeof data & { builder_id: string };
  return { ...(q as Omit<Quote, "builder">), amount: Number(data.amount), builder: (who?.company as string | null) ?? (who?.name as string | null) ?? "The builder" };
}

/** The accepted quote for each of these projects, if any. */
export async function acceptedQuotes(projectIds: string[]): Promise<Map<string, { amount: number; currency: string }>> {
  if (!projectIds.length) return new Map();
  const { data } = await db().from("quotes").select("project_id, amount, currency, created_at").in("project_id", projectIds).eq("status", "accepted").order("created_at", { ascending: false });
  const out = new Map<string, { amount: number; currency: string }>();
  for (const q of data ?? []) if (!out.has(q.project_id)) out.set(q.project_id, { amount: Number(q.amount), currency: q.currency });
  return out;
}

/** A phase has finished (or the client moved in: "handover"): remind whoever set out a fee due on it to bill it. */
/** `lead`: what just happened, "Foundations and structure is done". */
export async function remindToBill(p: { id: string; title: string | null }, phase: string, lead: string) {
  const { data } = await db().from("milestones").select("label, amount, currency, created_by").eq("project_id", p.id).eq("phase", phase).eq("status", "planned");
  for (const m of data ?? []) {
    const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: m.currency, maximumFractionDigits: 0 }).format(Number(m.amount));
    await db().from("events").insert({ user_id: m.created_by, project_id: p.id, kind: "fee", data: { project: p.title, text: `${lead} on ${p.title ?? "the project"}: time to bill ${m.label} (${amount}).` } });
  }
}
