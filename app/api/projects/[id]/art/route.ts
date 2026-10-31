import { accessTo } from "@/lib/auth/request";
import { artAndSound } from "@/lib/art/fetch";

// Art and sound for a design: galleries near the site for the art wall, and a playlist matched to what they love.
export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/art">) {
  const a = await accessTo((await ctx.params).id, request.headers.get("cookie"));
  if (!a) return Response.json({ error: "not found" }, { status: 404 });
  try {
    return Response.json(await artAndSound(a.project));
  } catch {
    return Response.json({ art: [], music: [], near: null, because: [] });
  }
}
