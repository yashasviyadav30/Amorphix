import { supabaseAdmin } from "../supabase/admin.ts";
import { latestVersion, saveVersion, updateProject, type Project } from "./store.ts";
import { isPro, type ProjectRole } from "./access.ts";
import { eventText, statusAfter, type ThreadEvent } from "./review.ts";

// The project thread: messages, the project's own events, who gets told, unread counts, and review.

const db = () => supabaseAdmin();
export type Channel = "all" | "team";

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export type Attachment = { path: string; name: string; type: string; size: number; url?: string };
export type Message = {
  id: number;
  channel: Channel;
  kind: "message" | "event";
  author_id: string | null;
  author_name: string;
  body: string;
  room_id: string | null;
  room_name: string | null;
  level: number | null;
  version: number | null;
  data: Partial<ThreadEvent> & Record<string, unknown>;
  attachments: Attachment[];
  created_at: string;
};

/** The name someone goes by in a thread: their profile name, else their email. */
export async function nameOf(userId: string): Promise<string> {
  const row = await must<{ name: string } | null>(db().from("profiles").select("name").eq("user_id", userId).maybeSingle());
  if (row?.name) return row.name;
  const { data } = await db().auth.admin.getUserById(userId);
  return data.user?.email ?? "Someone";
}

/** Everyone on a project with their role, owner first. */
export async function peopleOn(p: Pick<Project, "id" | "owner_id">): Promise<{ user_id: string; role: ProjectRole }[]> {
  const rows = await must<{ user_id: string; role: ProjectRole }[]>(db().from("project_members").select("user_id, role").eq("project_id", p.id));
  return [...(p.owner_id ? [{ user_id: p.owner_id, role: "owner" as ProjectRole }] : []), ...rows];
}

/** The team-only channel exists for a pro when the project has two or more pros (architect and builder). */
export async function hasTeamChannel(p: Pick<Project, "id" | "owner_id">, role: ProjectRole): Promise<boolean> {
  if (!isPro(role)) return false;
  return (await peopleOn(p)).filter((x) => isPro(x.role)).length >= 2;
}

async function notify(p: Pick<Project, "id" | "owner_id" | "title">, except: string | null, channel: Channel, kind: string, data: Record<string, unknown>) {
  const people = (await peopleOn(p)).filter((x) => x.user_id !== except && (channel === "all" || isPro(x.role)));
  if (!people.length) return;
  await must(db().from("events").insert(people.map((x) => ({ user_id: x.user_id, project_id: p.id, kind, data: { ...data, project: p.title } }))));
}

type Post = { channel?: Channel; body: string; room?: { id: string; name: string; level: number } | null; attachments?: Attachment[]; version?: number | null };

/** A message from a person. Everyone else on the channel is told. */
export async function postMessage(p: Pick<Project, "id" | "owner_id" | "title">, author: { id: string; name: string }, m: Post) {
  const channel = m.channel ?? "all";
  const row = await must<Message>(
    db()
      .from("messages")
      .insert({
        project_id: p.id,
        channel,
        kind: "message",
        author_id: author.id,
        author_name: author.name,
        body: m.body,
        room_id: m.room?.id ?? null,
        room_name: m.room?.name ?? null,
        level: m.room?.level ?? null,
        version: m.version ?? null,
        attachments: (m.attachments ?? []).map(({ url: _u, ...a }) => a),
      })
      .select()
      .single(),
  );
  await notify(p, author.id, channel, "message", { by: author.name, text: m.body.slice(0, 140), room: m.room?.name ?? null });
  return row;
}

/** One of the project's own events (a plan chosen, a change saved, a review), posted in the thread for everyone.
 *  `quiet`: in the thread only, no bell (each finished phase of a build would otherwise ring it). */
export async function postEvent(p: Pick<Project, "id" | "owner_id" | "title">, actor: { id: string | null; name: string }, e: ThreadEvent, quiet = false) {
  const body = eventText(e, actor.name);
  await must(
    db()
      .from("messages")
      .insert({ project_id: p.id, channel: "all", kind: "event", author_id: actor.id, author_name: actor.name, body, version: "version" in e ? e.version : null, data: e }),
  );
  if (!quiet) await notify(p, actor.id, "all", e.type, { by: actor.name, text: body });
}

/** The latest messages on a channel, oldest first, with short-lived links to their files. */
export async function listMessages(projectId: string, channel: Channel, limit = 200): Promise<Message[]> {
  const rows = await must<Message[]>(db().from("messages").select().eq("project_id", projectId).eq("channel", channel).order("created_at", { ascending: false }).limit(limit));
  const paths = rows.flatMap((r) => r.attachments.map((a) => a.path));
  if (paths.length) {
    const { data } = await db().storage.from("thread").createSignedUrls(paths, 60 * 60);
    const url = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
    for (const r of rows) r.attachments = r.attachments.map((a) => ({ ...a, url: url.get(a.path) ?? undefined }));
  }
  return rows.reverse();
}

export async function markRead(projectId: string, userId: string, channel: Channel) {
  await must(db().from("thread_reads").upsert({ project_id: projectId, user_id: userId, channel, read_at: new Date().toISOString() }));
}

/** Messages on the main channel this person hasn't seen (their own don't count). */
export async function unreadCount(projectId: string, userId: string): Promise<number> {
  const read = await must<{ read_at: string } | null>(db().from("thread_reads").select("read_at").eq("project_id", projectId).eq("user_id", userId).eq("channel", "all").maybeSingle());
  let q = db().from("messages").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("channel", "all").or(`author_id.is.null,author_id.neq.${userId}`);
  if (read) q = q.gt("created_at", read.read_at);
  const { count } = await q;
  return count ?? 0;
}

/** The version the review is about: the latest saved one, or the chosen plan saved as version 1. */
async function currentVersion(p: Project): Promise<number> {
  const last = await latestVersion(p.id);
  if (last) return last.version;
  const layout = p.chosen_option !== null ? p.options?.[p.chosen_option] : null;
  if (!layout) throw new Error("Choose a plan first.");
  return saveVersion(p.id, layout, "Chose this plan");
}

export async function sendForReview(p: Project, actor: { id: string | null; name: string }) {
  const version = await currentVersion(p);
  await updateProject(p.id, { status: statusAfter("send", p.status) });
  await postEvent(p, actor, { type: "review", version });
  return version;
}

/** The client's answer. Any one client's approval counts; it locks this version. */
export async function decide(p: Project, actor: { id: string; name: string }, decision: "approved" | "changes", note: string | null, inPerson: string | null = null) {
  const version = await currentVersion(p);
  await must(db().from("approvals").insert({ project_id: p.id, version, user_id: actor.id, decision, note }));
  await updateProject(p.id, { status: statusAfter(decision === "approved" ? "approve" : "changes", p.status) });
  await postEvent(p, actor, decision === "approved" ? { type: "approved", version, note, for: inPerson } : { type: "changes", version, note, for: inPerson });
  return version;
}

/** The latest approval, for "Approved v3 by Priya". */
export async function lastApproval(projectId: string) {
  const rows = await must<{ version: number; user_id: string; decision: string; created_at: string }[]>(
    db().from("approvals").select("version, user_id, decision, created_at").eq("project_id", projectId).eq("decision", "approved").order("created_at", { ascending: false }).limit(1),
  );
  if (!rows[0]) return null;
  return { ...rows[0], by: await nameOf(rows[0].user_id) };
}

/** Who answers a review: the clients when there are any; otherwise the owner (owner mode, e.g. with a builder). */
export async function decides(p: Pick<Project, "id" | "owner_id">, role: ProjectRole): Promise<boolean> {
  if (role === "client") return true;
  if (role !== "owner") return false;
  return !(await peopleOn(p)).some((x) => x.role === "client");
}

/** A pro's client who isn't on Amorphix: the pro records their answer from a meeting. Their first name, else null. */
export async function inPersonClient(p: Pick<Project, "id" | "owner_id" | "mode" | "designed_for">, role: ProjectRole): Promise<string | null> {
  if (role !== "owner" || p.mode !== "pro" || !p.designed_for) return null;
  return (await peopleOn(p)).some((x) => x.role === "client") ? null : p.designed_for.trim().split(/\s+/)[0];
}
