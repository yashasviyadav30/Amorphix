import { supabaseAdmin } from "../supabase/admin.ts";
import { proActive } from "../project/unlock.ts";
import { ratingLine } from "../project/movein.ts";
import { fitOf, rank, type Fit } from "./match.ts";
import type { Project } from "../project/store.ts";

// The pros a client can bring onto a project, ranked by how well their past Amorphix work fits the client's taste,
// and the requests that ask them to join.

const db = () => supabaseAdmin();
export type ProRole = "architect" | "builder";

type ProfileRow = { user_id: string; role: string; name: string; company: string | null; city: string | null; logo_url: string | null; about: string | null; fee_note: string | null; plan: string; plan_until: string | null; trial_until: string | null; demo: boolean };
type Work = { id: string; title: string | null; taste: { tags: { family: string; value: string; weight: number }[] } | null; brief: { name?: string } | null };

export type ProCard = Omit<ProfileRow, "plan" | "plan_until" | "trial_until" | "demo" | "role"> & { role: ProRole; fit: Fit; projects: number; styles: string[]; requested: boolean; rating: string | null };

/** What clients who moved in said, as "★ 4.7 · 3 reviews", per pro. */
async function ratingsOf(ids: string[]): Promise<Map<string, string | null>> {
  if (!ids.length) return new Map();
  const { data } = await db().from("reviews").select("pro_id, rating").in("pro_id", ids);
  const rows = (data ?? []) as { pro_id: string; rating: number }[];
  return new Map(ids.map((id) => [id, ratingLine(rows.filter((r) => r.pro_id === id).map((r) => r.rating))]));
}

/** Every project a pro has worked on: their own and the ones they joined as architect or builder. */
async function workOf(userIds: string[]): Promise<Map<string, Work[]>> {
  const [own, joined] = await Promise.all([
    db().from("projects").select("id, title, taste, brief, owner_id").in("owner_id", userIds).not("brief", "is", null),
    db().from("project_members").select("user_id, projects(id, title, taste, brief)").in("user_id", userIds).in("role", ["architect", "builder"]),
  ]);
  const out = new Map<string, Work[]>();
  const add = (id: string, w: Work | null) => w && out.set(id, [...(out.get(id) ?? []), w]);
  for (const p of (own.data ?? []) as (Work & { owner_id: string })[]) add(p.owner_id, p);
  for (const m of (joined.data ?? []) as unknown as { user_id: string; projects: Work | null }[]) add(m.user_id, m.projects);
  return out;
}

/** Listed pros of one kind, with a live plan or trial, best fit for this project first. */
export async function prosFor(p: Pick<Project, "id" | "owner_id" | "taste" | "site">, role: ProRole): Promise<ProCard[]> {
  const { data } = await db()
    .from("profiles")
    .select("user_id, role, name, company, city, logo_url, about, fee_note, plan, plan_until, trial_until, demo")
    .eq("role", role)
    .eq("listed", true)
    .not("city", "is", null)
    .limit(200);
  const [{ data: members }, { data: asked }] = await Promise.all([
    db().from("project_members").select("user_id").eq("project_id", p.id),
    db().from("pro_requests").select("pro_id").eq("project_id", p.id).eq("status", "pending"),
  ]);
  const on = new Set([p.owner_id, ...(members ?? []).map((m) => m.user_id)]);
  const pros = ((data ?? []) as ProfileRow[]).filter((x) => proActive(x) && !on.has(x.user_id));
  const [work, ratings] = await Promise.all([workOf(pros.map((x) => x.user_id)), ratingsOf(pros.map((x) => x.user_id))]);
  const requested = new Set((asked ?? []).map((r) => r.pro_id));
  return rank(
    pros.map(({ plan: _p, plan_until: _u, trial_until: _t, demo: _d, role: _r, ...x }) => {
      const done = work.get(x.user_id) ?? [];
      return {
        ...x,
        role,
        fit: fitOf(p.taste, p.site?.location, { tastes: done.map((w) => w.taste), city: x.city }),
        projects: done.length,
        styles: [...new Set(done.map((w) => w.brief?.name).filter((n): n is string => !!n))].slice(0, 3),
        requested: requested.has(x.user_id),
        rating: ratings.get(x.user_id) ?? null,
      };
    }),
  );
}

/** A client asks a pro to join. One open request per pro per project; the pro is told. */
export async function requestPro(p: Pick<Project, "id" | "title">, from: { id: string; name: string }, proId: string, role: ProRole, message: string | null) {
  const { data: pro } = await db().from("profiles").select("role, listed").eq("user_id", proId).maybeSingle();
  if (!pro || pro.role !== role || !pro.listed) throw new Error("That pro isn't taking requests.");
  const { error } = await db().from("pro_requests").upsert({ project_id: p.id, pro_id: proId, from_id: from.id, role, message, status: "pending", answered_at: null }, { onConflict: "project_id,pro_id" });
  if (error) throw new Error(error.message);
  await db().from("events").insert({ user_id: proId, project_id: p.id, kind: "request", data: { by: from.name, project: p.title, text: `${from.name} asked you to join ${p.title ?? "their project"} as the ${role}.` } });
}

export type Request = { id: number; project_id: string; role: ProRole; message: string | null; created_at: string; title: string | null; space_type: string | null; location: string | null; from: string };

/** The open requests waiting for a pro. */
export async function requestsFor(proId: string): Promise<Request[]> {
  const { data } = await db()
    .from("pro_requests")
    .select("id, project_id, role, message, created_at, from_id, projects(title, space_type, site)")
    .eq("pro_id", proId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as { id: number; project_id: string; role: ProRole; message: string | null; created_at: string; from_id: string; projects: { title: string | null; space_type: string | null; site: { location?: string } } | null }[];
  const ids = [...new Set(rows.map((r) => r.from_id))];
  const { data: names } = ids.length ? await db().from("profiles").select("user_id, name").in("user_id", ids) : { data: [] };
  return rows.map((r) => ({
    id: r.id,
    project_id: r.project_id,
    role: r.role,
    message: r.message,
    created_at: r.created_at,
    title: r.projects?.title ?? null,
    space_type: r.projects?.space_type ?? null,
    location: r.projects?.site?.location ?? null,
    from: (names ?? []).find((n) => n.user_id === r.from_id)?.name ?? "A client",
  }));
}

/** Whether this person has an open request on this project (they may look at it before saying yes). */
export async function hasOpenRequest(projectId: string, userId: string): Promise<boolean> {
  const { count } = await db().from("pro_requests").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("pro_id", userId).eq("status", "pending");
  return !!count;
}

/** The pro's answer. Saying yes needs a live plan or trial; they join with the role asked for. */
export async function answerRequest(id: number, pro: { id: string; name: string }, accept: boolean): Promise<{ projectId: string } | { error: string; status: number }> {
  const { data: r } = await db().from("pro_requests").select("id, project_id, role, from_id, status").eq("id", id).eq("pro_id", pro.id).maybeSingle();
  if (!r || r.status !== "pending") return { error: "That request isn't open any more.", status: 410 };
  if (accept) {
    const { data: me } = await db().from("profiles").select("plan, plan_until, trial_until, demo").eq("user_id", pro.id).maybeSingle();
    if (!proActive(me as never)) return { error: "Your trial has ended. Pick a plan to take on new clients.", status: 402 };
    const { error } = await db().from("project_members").upsert({ project_id: r.project_id, user_id: pro.id, role: r.role, invited_by: r.from_id });
    if (error) return { error: error.message, status: 500 };
  }
  await db().from("pro_requests").update({ status: accept ? "accepted" : "declined", answered_at: new Date().toISOString() }).eq("id", id);
  const { data: project } = await db().from("projects").select("id, owner_id, title").eq("id", r.project_id).single();
  if (accept && project) {
    const { postEvent } = await import("../project/thread.ts");
    await postEvent(project, pro, { type: "joined", role: r.role }).catch(() => {});
  }
  // a yes is told once, by the "joined" above; a no is told here
  if (!accept) await db().from("events").insert({ user_id: r.from_id, project_id: r.project_id, kind: "declined", data: { by: pro.name, project: project?.title ?? null, text: `${pro.name} can't take this one on right now.` } });
  return { projectId: r.project_id };
}

/** A pro's public page: who they are and the styles of their work on Amorphix. Only listed pros have one. */
export async function proProfile(userId: string) {
  const { data } = await db().from("profiles").select("user_id, role, name, company, city, logo_url, about, fee_note, listed").eq("user_id", userId).maybeSingle();
  if (!data || !data.listed || (data.role !== "architect" && data.role !== "builder")) return null;
  const [work, ratings, { data: said }] = await Promise.all([
    workOf([userId]),
    ratingsOf([userId]),
    db().from("reviews").select("rating, text, created_at").eq("pro_id", userId).not("text", "is", null).order("created_at", { ascending: false }).limit(5),
  ]);
  const done = work.get(userId) ?? [];
  return { ...data, rating: ratings.get(userId) ?? null, said: (said ?? []) as { rating: number; text: string; created_at: string }[], projects: done.length, styles: [...new Set(done.map((w) => w.brief?.name).filter((n): n is string => !!n))].slice(0, 6) };
}

/** The request a pro has open on this project, to answer from the project itself. */
export async function openRequest(projectId: string, proId: string): Promise<{ id: number; role: ProRole; from: string; message: string | null } | null> {
  const { data } = await db().from("pro_requests").select("id, role, message, from_id").eq("project_id", projectId).eq("pro_id", proId).eq("status", "pending").maybeSingle();
  if (!data) return null;
  const { data: who } = await db().from("profiles").select("name").eq("user_id", data.from_id).maybeSingle();
  return { id: data.id as number, role: data.role as ProRole, from: (who?.name as string | undefined) ?? "The owner", message: (data.message as string | null) ?? null };
}
