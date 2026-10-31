import { accessTo, userOf } from "@/lib/auth/request";
import { unlockProject } from "@/lib/project/unlock";

// Unlock a project (one-time price). ponytail: unlocks without charging until PayPal checkout lands in R5; only the
// owner can press it, and the button says so.
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/unlock">) {
  const a = await accessTo((await ctx.params).id, request.headers.get("cookie"), "edit");
  if (!a || a.role !== "owner") return Response.json({ error: "Only the project's owner can unlock it." }, { status: 403 });
  // try first, sign in to keep: an unlocked project belongs to an account, never only to this browser
  if (!(await userOf(request.headers.get("cookie")))) return Response.json({ error: "Sign in first, so the unlocked project is saved to your account.", signIn: true }, { status: 401 });
  await unlockProject(a.project.id);
  return Response.json({ ok: true });
}
