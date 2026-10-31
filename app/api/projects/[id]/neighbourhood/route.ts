import { accessTo } from "@/lib/auth/request";
import { neighbourhoodOf } from "@/lib/neighbourhood/fetch";
import { isCrowd } from "@/lib/neighbourhood/read";

// The neighbourhood read for a business project, for everyone on it. ?crowd= re-ranks it for who it's for.
export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/neighbourhood">) {
  const a = await accessTo((await ctx.params).id, request.headers.get("cookie"));
  if (!a) return Response.json({ error: "not found" }, { status: 404 });
  const c = new URL(request.url).searchParams.get("crowd");
  try {
    return Response.json({ read: await neighbourhoodOf(a.project, isCrowd(c) ? c : "all") });
  } catch {
    return Response.json({ read: null });
  }
}
