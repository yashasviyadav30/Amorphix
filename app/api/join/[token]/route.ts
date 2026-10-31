import { requireUser } from "@/lib/auth/user";
import { acceptInvite } from "@/lib/project/team";
import { getProject } from "@/lib/project/store";

// Accept an invite link. Needs a signed-in account, so everyone on a project is a real person. A client joining
// a project that still waits for answers is sent straight to Let's get to know you.
export async function POST(request: Request, ctx: RouteContext<"/api/join/[token]">) {
  const who = await requireUser(request);
  if ("error" in who) return who.error;
  const result = await acceptInvite((await ctx.params).token, who.userId);
  if ("error" in result) return Response.json(result, { status: 410 });
  const p = await getProject(result.projectId);
  return Response.json({ ...result, next: p.status === "interview" ? `/start?project=${p.id}` : `/project/${p.id}` });
}
