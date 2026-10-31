import { z } from "zod";
import { ownedProject, publicProject } from "@/lib/auth/request";
import { confirmImport } from "@/lib/plan-import/flow";

// Qloo look-ups for a few loves, then the layout engine for two alternatives.
export const maxDuration = 120;

const Body = z.object({
  edits: z.array(z.object({ id: z.string().max(80), name: z.string().max(60).optional(), kind: z.string().max(30).optional() })).max(60),
  answers: z.record(z.string().max(300), z.string().max(300)).optional(),
  size: z.object({ width: z.number().positive().max(2000), depth: z.number().positive().max(2000) }).optional(),
  picks: z.array(z.object({ slot: z.enum(["place", "brand", "media"]), id: z.string().max(120), name: z.string().min(1).max(200) })).length(3),
  location: z.string().trim().min(2).max(100),
  title: z.string().max(60).optional(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/import">) {
  const p = await ownedProject((await ctx.params).id, request.headers.get("cookie"), "edit");
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Something in the form isn't right. Please check it and try again." }, { status: 400 });
  try {
    return Response.json(publicProject(await confirmImport(p.id, body.data)));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't use this plan." }, { status: 422 });
  }
}
