import { supabaseAdmin } from "../supabase/admin.ts";
import { ownsProject, type Project } from "./store.ts";
import { invitable, MEMBER_ROLES, type MemberRole, type ProjectRole } from "./access.ts";

// The people on a project and the invite links that add them.

const db = () => supabaseAdmin();
const WEEK = 7 * 24 * 60 * 60 * 1000;

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

/** The person's role on this project, or null when they have none. */
export async function roleFor(p: Pick<Project, "id" | "owner_id" | "guest_id">, who: { userId?: string | null; guestId?: string | null }): Promise<ProjectRole | null> {
  if (ownsProject(p, who)) return "owner";
  if (!who.userId) return null;
  const row = await must<{ role: MemberRole } | null>(db().from("project_members").select("role").eq("project_id", p.id).eq("user_id", who.userId).maybeSingle());
  if (row) return row.role;
  // A pro asked to join may look at the design, read only, before saying yes.
  const { hasOpenRequest } = await import("../pros/directory.ts");
  return (await hasOpenRequest(p.id, who.userId)) ? "viewer" : null;
}

export type TeamMember = { user_id: string; role: ProjectRole; name: string | null; email: string | null; company: string | null; kind: string | null };
export type OpenInvite = { token: string; role: MemberRole; expires_at: string; created_at: string };

/** Everyone on the project, owner first, with names from their profiles; and the invites nobody has used yet. */
export async function teamOf(p: Pick<Project, "id" | "owner_id">): Promise<{ members: TeamMember[]; invites: OpenInvite[] }> {
  const [rows, invites] = await Promise.all([
    must<{ user_id: string; role: MemberRole }[]>(db().from("project_members").select("user_id, role").eq("project_id", p.id).order("created_at")),
    must<OpenInvite[]>(
      db().from("invites").select("token, role, expires_at, created_at").eq("project_id", p.id).is("used_by", null).eq("revoked", false).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
    ),
  ]);
  const people = [...(p.owner_id ? [{ user_id: p.owner_id, role: "owner" as ProjectRole }] : []), ...rows];
  const ids = people.map((m) => m.user_id);
  const profiles = ids.length ? await must<{ user_id: string; name: string; company: string | null; role: string }[]>(db().from("profiles").select("user_id, name, company, role").in("user_id", ids)) : [];
  const emails = await Promise.all(ids.map((id) => db().auth.admin.getUserById(id).then((r) => r.data.user?.email ?? null)));
  const members = people.map((m, i) => {
    const pr = profiles.find((x) => x.user_id === m.user_id);
    return { ...m, name: pr?.name ?? null, company: pr?.company ?? null, kind: pr?.role ?? null, email: emails[i] };
  });
  return { members, invites };
}

const newToken = () => [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function createInvite(projectId: string, by: { userId: string; role: ProjectRole }, role: MemberRole): Promise<OpenInvite> {
  // the rules depend on the project: one client, and only on a pro's project (lib/project/access.ts invitable)
  const [{ mode }, clients, links] = await Promise.all([
    must<{ mode: "owner" | "pro" }>(db().from("projects").select("mode").eq("id", projectId).single()),
    must<{ user_id: string }[]>(db().from("project_members").select("user_id").eq("project_id", projectId).eq("role", "client")),
    must<{ token: string }[]>(db().from("invites").select("token").eq("project_id", projectId).eq("role", "client").is("used_by", null).eq("revoked", false).gt("expires_at", new Date().toISOString())),
  ]);
  if (!invitable(by.role, mode, clients.length + links.length > 0).includes(role)) throw new Error("You can't invite that role.");
  return must<OpenInvite>(
    db().from("invites").insert({ token: newToken(), project_id: projectId, role, created_by: by.userId, expires_at: new Date(Date.now() + WEEK).toISOString() }).select("token, role, expires_at, created_at").single(),
  );
}

export const revokeInvite = (projectId: string, token: string) => must(db().from("invites").update({ revoked: true }).eq("project_id", projectId).eq("token", token));

export const removeMember = (projectId: string, userId: string) => must(db().from("project_members").delete().eq("project_id", projectId).eq("user_id", userId));

/** The name of the person a project was designed for: its owner, who answered "Let's get to know you". */
export async function ownerName(ownerId: string | null): Promise<string | null> {
  if (!ownerId) return null;
  const row = await must<{ name: string } | null>(db().from("profiles").select("name").eq("user_id", ownerId).maybeSingle());
  return row?.name ?? null;
}

export type InviteInfo = { project_id: string; role: MemberRole; title: string | null; space_type: string | null; location: string | null; from: string | null; logo: string | null; owner: string | null; state: "open" | "used" | "expired" };

const TOKEN = /^[0-9a-f]{64}$/;

/** What an invite link is for, so the join page can say who invited you to what. */
export async function inviteInfo(token: string): Promise<InviteInfo | null> {
  if (!TOKEN.test(token)) return null;
  const inv = await must<{ project_id: string; role: MemberRole; created_by: string; expires_at: string; used_by: string | null; revoked: boolean } | null>(
    db().from("invites").select("project_id, role, created_by, expires_at, used_by, revoked").eq("token", token).maybeSingle(),
  );
  if (!inv || inv.revoked) return null;
  const [project, from] = await Promise.all([
    must<{ title: string | null; space_type: string | null; site: { location?: string }; owner_id: string | null; designed_for: string | null }>(db().from("projects").select("title, space_type, site, owner_id, designed_for").eq("id", inv.project_id).single()),
    must<{ name: string; company: string | null; logo_url: string | null } | null>(db().from("profiles").select("name, company, logo_url").eq("user_id", inv.created_by).maybeSingle()),
  ]);
  return {
    owner: project.designed_for ?? (await ownerName(project.owner_id)),
    project_id: inv.project_id,
    role: inv.role,
    title: project.title,
    space_type: project.space_type,
    location: project.site?.location ?? null,
    from: from ? (from.company ? `${from.name} (${from.company})` : from.name) : null,
    logo: from?.logo_url ?? null,
    state: inv.used_by ? "used" : new Date(inv.expires_at) < new Date() ? "expired" : "open",
  };
}

/**
 * Joins the project through an invite. Each link works once: it's claimed in the same update that checks it is
 * still open, so two people opening it at once can't both join. The owner joining their own link changes nothing.
 */
export async function acceptInvite(token: string, userId: string): Promise<{ projectId: string } | { error: string }> {
  if (!TOKEN.test(token)) return { error: "That invite link isn't valid." };
  const now = new Date().toISOString();
  const claimed = await must<{ project_id: string; role: MemberRole; created_by: string }[]>(
    db().from("invites").update({ used_by: userId, used_at: now }).eq("token", token).is("used_by", null).eq("revoked", false).gt("expires_at", now).select("project_id, role, created_by"),
  );
  const inv = claimed[0];
  if (!inv) {
    // Opening your own already-used link again just takes you to the project.
    const mine = await must<{ project_id: string } | null>(db().from("invites").select("project_id").eq("token", token).eq("used_by", userId).maybeSingle());
    return mine ? { projectId: mine.project_id } : { error: "This invite has already been used or has expired. Ask for a new one." };
  }
  const project = await must<{ owner_id: string | null }>(db().from("projects").select("owner_id").eq("id", inv.project_id).single());
  if (project.owner_id !== userId && MEMBER_ROLES.includes(inv.role)) {
    await must(db().from("project_members").upsert({ project_id: inv.project_id, user_id: userId, role: inv.role, invited_by: inv.created_by }));
    const { postEvent, nameOf } = await import("./thread.ts");
    const full = await must<{ id: string; owner_id: string | null; title: string | null }>(db().from("projects").select("id, owner_id, title").eq("id", inv.project_id).single());
    await postEvent(full, { id: userId, name: await nameOf(userId) }, { type: "joined", role: inv.role }).catch((e) => console.warn("thread event failed:", e));
  }
  return { projectId: inv.project_id };
}

/** Projects someone was invited to, for their home page. */
export async function memberProjects(userId: string) {
  type Card = { id: string; title: string | null; space_type: string | null; status: string; mode: string; site: { location?: string }; updated_at: string; owner_id: string | null; chosen_option: number | null; unlocked_at: string | null; designed_for: string | null; toured_at: string | null };
  // The join returns one project per membership row (an object, though the client types it as a list).
  const rows = (await must(db().from("project_members").select("role, projects(id, title, space_type, status, mode, site, updated_at, owner_id, chosen_option, unlocked_at, designed_for, toured_at)").eq("user_id", userId))) as unknown as { role: MemberRole; projects: Card | null }[];
  const cards = rows.filter((r) => r.projects);
  const names = await Promise.all(cards.map((r) => r.projects!.designed_for ?? ownerName(r.projects!.owner_id)));
  return cards.map((r, i) => ({ ...r.projects!, role: r.role, owner: names[i] }));
}

/** The studio behind a project, for branding: the architect on it, else the pro who owns it. */
export async function studioOf(p: Pick<Project, "id" | "owner_id" | "mode">): Promise<{ id: string; name: string; logo_url: string | null } | null> {
  const arch = await must<{ user_id: string } | null>(db().from("project_members").select("user_id").eq("project_id", p.id).eq("role", "architect").limit(1).maybeSingle());
  const id = arch?.user_id ?? (p.mode === "pro" ? p.owner_id : null);
  if (!id) return null;
  const pr = await must<{ name: string; company: string | null; logo_url: string | null; role: string } | null>(db().from("profiles").select("name, company, logo_url, role").eq("user_id", id).maybeSingle());
  if (!pr || (pr.role !== "architect" && pr.role !== "builder")) return null;
  return { id, name: pr.company ?? pr.name, logo_url: pr.logo_url };
}
