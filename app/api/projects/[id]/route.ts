import { supabaseAdmin } from "@/lib/supabase/admin";
import { openRequest } from "@/lib/pros/directory";
import { accessTo, publicProject, userOf } from "@/lib/auth/request";
import { peopleOn, unreadCount } from "@/lib/project/thread";
import { isPro } from "@/lib/project/access";
import { ownerName, studioOf } from "@/lib/project/team";
import { unlockedFor } from "@/lib/project/unlock";
import { whoseName } from "@/lib/project/stage";
import { deleteProject } from "@/lib/account/erase";

export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const a = await accessTo((await ctx.params).id, request.headers.get("cookie"));
  if (!a) return Response.json({ error: "not found" }, { status: 404 });
  const me = await userOf(request.headers.get("cookie"));
  const [unlocked, owner, unread, people, studio] = await Promise.all([
    unlockedFor(a.project),
    a.role === "owner" && !a.project.designed_for ? null : ownerName(a.project.owner_id),
    me ? unreadCount(a.project.id, me) : 0,
    peopleOn(a.project),
    studioOf(a.project),
  ]);
  // Which pros are on it, for "Who will build this?"
  const pros = people.filter((x) => isPro(x.role)).map((x) => x.role);
  // Whose design it is ("Vicky's design"): everyone else sees the owner's name; an owner sees "your", except a pro on
  // their client's project, which is the client's ("Priya's design").
  const whose = a.role === "owner" && a.project.mode !== "pro" ? null : whoseName(a.project.designed_for, owner);
  // a pro's own project: what kind of pro owns it; and a pro who's been asked to join sees the request here
  const ownerKind = a.project.mode === "pro" && a.project.owner_id ? ((await supabaseAdmin().from("profiles").select("role").eq("user_id", a.project.owner_id).maybeSingle()).data?.role ?? null) : null;
  const asked = a.role === "viewer" && me ? await openRequest(a.project.id, me) : null;
  return Response.json({ ...publicProject(a.project), role: a.role, unlocked, whose, unread, pros, studio, ownerKind, request: asked });
}

// Deletes the project for everyone on it. Only its owner may.
export async function DELETE(request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const a = await accessTo((await ctx.params).id, request.headers.get("cookie"), "edit");
  if (!a || a.role !== "owner") return Response.json({ error: "not found" }, { status: 404 });
  await deleteProject(a.project.id);
  return Response.json({ ok: true });
}
