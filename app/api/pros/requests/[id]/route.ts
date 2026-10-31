import { z } from "zod";
import { requireUser } from "@/lib/auth/user";
import { nameOf } from "@/lib/project/thread";
import { answerRequest } from "@/lib/pros/directory";

const Body = z.object({ accept: z.boolean() });

// The pro says yes (joins the project) or no to a client's request.
export async function POST(request: Request, ctx: RouteContext<"/api/pros/requests/[id]">) {
  const who = await requireUser(request);
  if ("error" in who) return who.error;
  const id = Number((await ctx.params).id);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !body.success) return Response.json({ error: "That wasn't understood." }, { status: 400 });
  const out = await answerRequest(id, { id: who.userId, name: await nameOf(who.userId) }, body.data.accept);
  return "error" in out ? Response.json({ error: out.error }, { status: out.status }) : Response.json(out);
}
