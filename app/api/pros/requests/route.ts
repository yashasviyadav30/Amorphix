import { z } from "zod";
import { accessTo, userOf } from "@/lib/auth/request";
import { requireUser } from "@/lib/auth/user";
import { nameOf } from "@/lib/project/thread";
import { requestPro, requestsFor } from "@/lib/pros/directory";

// A pro's open requests from clients.
export async function GET(request: Request) {
  const who = await requireUser(request);
  if ("error" in who) return who.error;
  return Response.json({ requests: await requestsFor(who.userId) });
}

const Ask = z.object({ projectId: z.uuid(), proId: z.uuid(), role: z.enum(["architect", "builder"]), message: z.string().trim().max(1000).optional() });

// A project's owner asks a pro to join. Inviting is part of what unlocking opens.
export async function POST(request: Request) {
  const cookie = request.headers.get("cookie");
  const me = await userOf(cookie);
  if (!me) return Response.json({ error: "Sign in to ask a pro, so they know who's asking." }, { status: 401 });
  const body = Ask.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "That request wasn't understood." }, { status: 400 });
  const a = await accessTo(body.data.projectId, cookie, "invite", true);
  if (!a || a.role !== "owner") return Response.json({ error: "Only the project's owner can ask a pro to join." }, { status: 403 });
  try {
    await requestPro(a.project, { id: me, name: await nameOf(me) }, body.data.proId, body.data.role, body.data.message || null);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't send the request." }, { status: 409 });
  }
  return Response.json({ ok: true }, { status: 201 });
}
