import { ownedProject } from "@/lib/auth/request";
import { shoppingFor } from "@/lib/shop/fetch";
import { TIERS, type Tier } from "@/lib/budget/costs";

// The shopping list: Qloo brand look-ups and rivals on a first visit (about 15 s cold), cached after that.
export const maxDuration = 60;

export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/shopping">) {
  const p = await ownedProject((await ctx.params).id, request.headers.get("cookie"), "view", true);
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  const t = new URL(request.url).searchParams.get("tier");
  const tier = (TIERS as readonly string[]).includes(t ?? "") ? (t as Tier) : undefined;
  try {
    return Response.json(await shoppingFor(p, tier));
  } catch {
    return Response.json({ error: "Couldn't build the list just now. Try again in a moment." }, { status: 502 });
  }
}
