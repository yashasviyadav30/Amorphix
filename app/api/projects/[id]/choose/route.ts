import { z } from "zod";
import { ownedProject, publicProject } from "@/lib/auth/request";
import { chooseOption } from "@/lib/design/run";
import { actorOf } from "@/lib/project/actor";
import { postEvent } from "@/lib/project/thread";

const Body = z.object({ option: z.number().int().min(0).max(2) });

export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/choose">) {
  const p = await ownedProject((await ctx.params).id, request.headers.get("cookie"), "edit");
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "option must be 0, 1 or 2" }, { status: 400 });
  // Once approved, the plan is what gets built: a change goes through a change request in Make changes instead.
  if (p.chosen_option !== body.data.option && ["approved", "building", "done"].includes(p.status))
    return Response.json({ error: "This design is approved, so the plan stays. Ask for a change in Make changes; the client approves it." }, { status: 409 });
  try {
    const chosen = await chooseOption(p.id, body.data.option);
    // The thread records it; a failure there never undoes the choice.
    const plan = chosen.options?.[body.data.option]?.concept?.name ?? `option ${body.data.option + 1}`;
    if (p.chosen_option !== body.data.option) await postEvent(chosen, await actorOf(request.headers.get("cookie")), { type: "chose", plan }).catch((e) => console.warn("thread event failed:", e));
    return Response.json(publicProject(chosen));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "could not choose" }, { status: 422 });
  }
}
