import { z } from "zod";
import { accessTo } from "@/lib/auth/request";
import { updateProject } from "@/lib/project/store";

const Body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

// The owner sets the day their business opens; the home page counts down to it.
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/opening">) {
  const a = await accessTo((await ctx.params).id, request.headers.get("cookie"), "edit");
  if (!a || a.role !== "owner") return Response.json({ error: "not found" }, { status: 404 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Pick a date." }, { status: 400 });
  await updateProject(a.project.id, { site: { ...(a.project.site ?? {}), opening: body.data.date } } as never);
  return Response.json({ ok: true });
}
