import { ownedProject } from "@/lib/auth/request";
import { moodboard } from "@/lib/design/moodboard";

// Photos for the moodboard, from Qloo. Cached there, so opening the page again costs nothing.
export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/moodboard">) {
  const p = await ownedProject((await ctx.params).id, request.headers.get("cookie"));
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  try {
    return Response.json({ tiles: await moodboard(p) });
  } catch {
    return Response.json({ tiles: [] });
  }
}
