import { accessTo } from "@/lib/auth/request";
import { updateProject } from "@/lib/project/store";

// The guided steps are done: from now on the project opens on its home with tabs.
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/tour">) {
  const a = await accessTo((await ctx.params).id, request.headers.get("cookie"), "edit");
  if (!a) return Response.json({ error: "not found" }, { status: 404 });
  if (!a.project.toured_at) await updateProject(a.project.id, { toured_at: new Date().toISOString() });
  return Response.json({ ok: true });
}
