import { z } from "zod";
import { ownedProject } from "@/lib/auth/request";
import { ecoFor } from "@/lib/green/eco";
import { updateProject } from "@/lib/project/store";

// Eco brands from their taste and plant nurseries near the site, from Qloo (cached).
export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/green">) {
  const p = await ownedProject((await ctx.params).id, request.headers.get("cookie"));
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  try {
    return Response.json(await ecoFor(p));
  } catch {
    return Response.json({ brands: [], nurseries: [] });
  }
}

const Change = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plants"), room: z.string().max(80), n: z.number().int().min(1).max(20) }),
  z.object({ kind: z.literal("swap"), room: z.string().max(80), plant: z.string().max(60) }),
  z.object({ kind: z.literal("outdoor") }),
]);
const Body = z.object({ ticked: z.array(z.object({ id: z.string().max(160), label: z.string().max(200), change: Change })).max(80) });

// Saves the greenery changes the client ticked; the 3D places the plants they add.
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/green">) {
  const p = await ownedProject((await ctx.params).id, request.headers.get("cookie"), "edit");
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "That change couldn't be saved." }, { status: 400 });
  await updateProject(p.id, { interview: { ...p.interview, green: body.data.ticked } });
  return Response.json({ ok: true });
}
