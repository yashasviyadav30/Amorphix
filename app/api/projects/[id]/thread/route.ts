import { z } from "zod";
import { accessTo, userOf } from "@/lib/auth/request";
import { can } from "@/lib/project/access";
import { canSendForReview } from "@/lib/project/review";
import { pendingChange } from "@/lib/project/change";
import { decides, hasTeamChannel, inPersonClient, lastApproval, listMessages, markRead, nameOf, postMessage } from "@/lib/project/thread";

const cookie = (r: Request) => r.headers.get("cookie");
const Channel = z.enum(["all", "team"]);

// The thread for this person: the messages on a channel, what they may do, and the review state.
export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/thread">) {
  const a = await accessTo((await ctx.params).id, cookie(request));
  if (!a) return Response.json({ error: "not found" }, { status: 404 });
  const channel = Channel.catch("all").parse(new URL(request.url).searchParams.get("channel"));
  const team = await hasTeamChannel(a.project, a.role);
  if (channel === "team" && !team) return Response.json({ error: "not found" }, { status: 404 });
  const me = await userOf(cookie(request));
  const [messages, approval, decider, inPerson, pending] = await Promise.all([
    listMessages(a.project.id, channel),
    lastApproval(a.project.id),
    decides(a.project, a.role),
    inPersonClient(a.project, a.role),
    pendingChange(a.project),
  ]);
  if (me) await markRead(a.project.id, me, channel);
  return Response.json({
    messages,
    me,
    role: a.role,
    teamChannel: team,
    canPost: !!me && can(a.role, "message"),
    status: a.project.status,
    canReview: can(a.role, "review") && canSendForReview(a.project),
    canDecide: decider && a.project.status === "review",
    // a change to the approved design, waiting
    change: pending ? { from: pending.from, to: pending.to, notes: pending.notes, cost: pending.text, canDecide: decider } : null,
    // the client isn't on Amorphix: the pro records their answer from the meeting
    inPerson,
    // an approval the pro recorded for an in-person client reads as the client's
    approval: approval && a.project.mode === "pro" && approval.user_id === a.project.owner_id && a.project.designed_for ? { ...approval, by: `${a.project.designed_for} (in person)` } : approval,
  });
}

const Post = z.object({
  channel: Channel.default("all"),
  body: z.string().trim().min(1).max(4000),
  room: z.object({ id: z.string().max(80), name: z.string().max(80), level: z.number().int().min(0).max(5) }).nullable().optional(),
  attachments: z
    .array(z.object({ path: z.string().max(300), name: z.string().max(200), type: z.string().max(100), size: z.number().int().min(0).max(10_485_760) }))
    .max(6)
    .default([]),
});

export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/thread">) {
  const id = (await ctx.params).id;
  const a = await accessTo(id, cookie(request), "message");
  if (!a) return Response.json({ error: "not found" }, { status: 404 });
  const me = await userOf(cookie(request));
  if (!me) return Response.json({ error: "Sign in to post, so everyone knows who wrote it." }, { status: 401 });
  const body = Post.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "That message couldn't be sent." }, { status: 400 });
  if (body.data.channel === "team" && !(await hasTeamChannel(a.project, a.role))) return Response.json({ error: "not found" }, { status: 404 });
  // Files must have been uploaded to this project's folder (see thread/files).
  if (body.data.attachments.some((f) => !f.path.startsWith(`${id}/`))) return Response.json({ error: "That file isn't part of this project." }, { status: 400 });
  const message = await postMessage(a.project, { id: me, name: await nameOf(me) }, body.data);
  return Response.json(message, { status: 201 });
}
