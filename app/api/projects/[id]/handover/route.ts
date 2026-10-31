import { z } from "zod";
import { accessTo, userOf } from "@/lib/auth/request";
import { ownerName, studioOf } from "@/lib/project/team";
import { nameOf, postEvent } from "@/lib/project/thread";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ userId: z.uuid() });

// "Hand over to my architect": the owner gives the project to the architect on it, who runs it from their studio
// (their plan carries it). The owner stays on as the client, and the design keeps their name.
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/handover">) {
  const cookie = request.headers.get("cookie");
  const a = await accessTo((await ctx.params).id, cookie);
  const me = await userOf(cookie);
  if (!a || a.role !== "owner" || !me || a.project.owner_id !== me) return Response.json({ error: "Only the signed-in owner can hand a project over." }, { status: 403 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Who to hand it to?" }, { status: 400 });
  const db = supabaseAdmin();
  const { data: arch } = await db.from("project_members").select("user_id").eq("project_id", a.project.id).eq("user_id", body.data.userId).eq("role", "architect").maybeSingle();
  if (!arch) return Response.json({ error: "Hand it over to the architect on the project." }, { status: 409 });

  const designedFor = a.project.designed_for ?? (await ownerName(me));
  // Owner first (the project is never without one), then swap the memberships.
  const { error } = await db.from("projects").update({ owner_id: arch.user_id, mode: "pro", designed_for: designedFor }).eq("id", a.project.id).eq("owner_id", me);
  if (error) return Response.json({ error: "Couldn't hand it over." }, { status: 500 });
  await db.from("project_members").delete().eq("project_id", a.project.id).eq("user_id", arch.user_id);
  await db.from("project_members").upsert({ project_id: a.project.id, user_id: me, role: "client", invited_by: arch.user_id });

  const studio = await studioOf({ ...a.project, owner_id: arch.user_id, mode: "pro" });
  await postEvent({ ...a.project, owner_id: arch.user_id }, { id: me, name: await nameOf(me) }, { type: "handover", to: studio?.name ?? (await nameOf(arch.user_id)) }).catch(() => {});
  return Response.json({ ok: true });
}
