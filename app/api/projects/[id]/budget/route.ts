import { ownedProject } from "@/lib/auth/request";
import { tasteTier } from "@/lib/budget/tier";

// The tier a budget starts at, from the price of what they love (Qloo, cached). The estimate itself is worked out
// in the page, so switching tiers is instant.
export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/budget">) {
  const p = await ownedProject((await ctx.params).id, request.headers.get("cookie"), "view", true);
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  try {
    return Response.json(await tasteTier(p.taste_signals));
  } catch {
    return Response.json({ tier: "mid", signals: [] });
  }
}
