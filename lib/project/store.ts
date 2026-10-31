import { supabaseAdmin } from "../supabase/admin.ts";
import type { Layout, Program, SpaceType } from "../layout/schema.ts";
import type { Profile } from "../qloo/taste.ts";

export type Site = {
  width?: number;
  depth?: number;
  floors?: number;
  location?: string;
  units?: "imperial" | "metric";
  geo?: { lat: number; lon: number; for: string }; // where `location` is on the map, found once
};
export type TasteSignal = { entityId: string; name: string; layer: 1 | 2 | 3; type?: string };

export type Project = {
  id: string;
  owner_id: string | null;
  guest_id: string | null;
  mode: "owner" | "pro";
  space_type: SpaceType | null;
  title: string | null;
  status: "interview" | "designing" | "ready" | "review" | "approved" | "building" | "done";
  site: Site;
  interview: Record<string, unknown>;
  taste_signals: TasteSignal[];
  taste: Profile | null;
  brief: unknown;
  program: Program | null;
  options?: Layout[] | null;
  chosen_option: number | null;
  unlocked_at?: string | null; // paid once for this project (pros' plans unlock it too: lib/project/unlock.ts)
  toured_at?: string | null; // the guided steps are done; the project opens on its home
  self_build?: boolean; // the owner runs the site themselves
  designed_for?: string | null; // the person it was designed for, when a pro created it
  handed_over_at?: string | null; // the client accepted the handover and moved in
  warranty_months?: number | null; // the builder's warranty, from the handover
  handover_note?: string | null; // the builder's notes in the handover pack
};

type Patch = Partial<Omit<Project, "id">>;

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export const createProject = (fields: Patch = {}) =>
  must<Project>(supabaseAdmin().from("projects").insert(fields).select().single());

export const getProject = (id: string) =>
  must<Project>(supabaseAdmin().from("projects").select().eq("id", id).single());

export const updateProject = (id: string, patch: Patch) =>
  must<Project>(supabaseAdmin().from("projects").update(patch).eq("id", id).select().single());

// Once a project has an owner, only that account can open it. Until then, the browser that started it can.
export const ownsProject = (p: Pick<Project, "owner_id" | "guest_id">, who: { userId?: string | null; guestId?: string | null }) =>
  p.owner_id ? !!who.userId && p.owner_id === who.userId : !!who.guestId && p.guest_id === who.guestId;

export const deleteProject = (id: string) => must(supabaseAdmin().from("projects").delete().eq("id", id));

// Merge one interview section into what's already stored, so answers build up over the conversation.
export async function saveInterview(id: string, section: string, data: Record<string, unknown>) {
  const p = await getProject(id);
  const prev = (p.interview[section] as Record<string, unknown>) ?? {};
  return updateProject(id, { interview: { ...p.interview, [section]: { ...prev, ...data } } });
}

// Add taste signals, skipping entities already recorded.
export async function addTasteSignals(id: string, signals: TasteSignal[]) {
  const p = await getProject(id);
  const known = new Set(p.taste_signals.map((s) => s.entityId));
  const merged = [...p.taste_signals, ...signals.filter((s) => !known.has(s.entityId))];
  return updateProject(id, { taste_signals: merged });
}

export const bindSession = (sessionId: string, projectId: string, agent: string) =>
  must(supabaseAdmin().from("agent_sessions").upsert({ session_id: sessionId, project_id: projectId, agent }));

export async function projectForSession(sessionId: string): Promise<Project> {
  const row = await must<{ project_id: string } | null>(
    supabaseAdmin().from("agent_sessions").select("project_id").eq("session_id", sessionId).maybeSingle(),
  );
  if (!row) throw new Error("This session is not linked to a project.");
  return getProject(row.project_id);
}

export async function saveVersion(projectId: string, layout: Layout, note: string) {
  const last = await must<{ version: number }[]>(
    supabaseAdmin().from("project_versions").select("version").eq("project_id", projectId).order("version", { ascending: false }).limit(1),
  );
  const version = (last[0]?.version ?? 0) + 1;
  await must(supabaseAdmin().from("project_versions").insert({ project_id: projectId, version, layout, note }));
  return version;
}

export async function latestVersion(projectId: string): Promise<{ version: number; layout: Layout } | null> {
  const rows = await must<{ version: number; layout: Layout }[]>(
    supabaseAdmin().from("project_versions").select("version, layout").eq("project_id", projectId).order("version", { ascending: false }).limit(1),
  );
  return rows[0] ?? null;
}

/** The saved versions of a design, newest first, with what changed in each. */
export const listVersions = (projectId: string) =>
  must<{ version: number; note: string; created_at: string }[]>(
    supabaseAdmin().from("project_versions").select("version, note, created_at").eq("project_id", projectId).order("version", { ascending: false }).limit(30),
  );

/** Steps back one version: the newest is deleted and the one before it returned, or null if there's nothing to undo. */
export async function undoVersion(projectId: string): Promise<{ version: number; layout: Layout } | null> {
  const rows = await must<{ version: number; layout: Layout }[]>(
    supabaseAdmin().from("project_versions").select("version, layout").eq("project_id", projectId).order("version", { ascending: false }).limit(2),
  );
  if (rows.length < 2) return null;
  await must(supabaseAdmin().from("project_versions").delete().eq("project_id", projectId).eq("version", rows[0].version));
  return rows[1];
}
