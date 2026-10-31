import { z } from "zod";
import { accessTo, whoOf } from "@/lib/auth/request";
import { can, invitable, MEMBER_ROLES } from "@/lib/project/access";
import { createInvite, removeMember, revokeInvite, teamOf } from "@/lib/project/team";

const cookie = (r: Request) => r.headers.get("cookie");

// The team: who is on the project, the open invites, and which roles you may invite.
export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/team">) {
  const a = await accessTo((await ctx.params).id, cookie(request));
  if (!a) return Response.json({ error: "not found" }, { status: 404 });
  const { members, invites } = await teamOf(a.project);
  const { userId } = await whoOf(cookie(request));
  // a client already on it, or a client link out, counts as the one client
  const hasClient = members.some((m) => m.role === "client") || invites.some((i) => i.role === "client");
  const ownerKind = members.find((m) => m.role === "owner")?.kind ?? null;
  return Response.json({ role: a.role, signedIn: !!userId, me: userId, members, invites: can(a.role, "invite") ? invites : [], invitable: userId ? invitable(a.role, a.project.mode, hasClient, ownerKind) : [] });
}

const Invite = z.object({ role: z.enum(MEMBER_ROLES) });

export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/team">) {
  const a = await accessTo((await ctx.params).id, cookie(request), "invite", true);
  if (!a) return Response.json({ error: "not found" }, { status: 404 });
  const { userId } = await whoOf(cookie(request));
  if (!userId) return Response.json({ error: "Sign in to invite people, so they know who the invite is from." }, { status: 401 });
  const body = Invite.safeParse(await request.json().catch(() => null));
  const { members, invites } = await teamOf(a.project);
  const hasClient = members.some((m) => m.role === "client") || invites.some((i) => i.role === "client");
  if (!body.success || !invitable(a.role, a.project.mode, hasClient, members.find((m) => m.role === "owner")?.kind ?? null).includes(body.data.role)) return Response.json({ error: hasClient && body.success && body.data.role === "client" ? "This project already has its client." : "You can't invite that role." }, { status: 403 });
  const invite = await createInvite(a.project.id, { userId, role: a.role }, body.data.role);
  return Response.json(invite, { status: 201 });
}

const Remove = z.union([z.object({ token: z.string().regex(/^[0-9a-f]{64}$/) }), z.object({ user: z.uuid() })]);

// Cancel an invite (anyone who may invite), or take someone off the project (owner only).
export async function DELETE(request: Request, ctx: RouteContext<"/api/projects/[id]/team">) {
  const a = await accessTo((await ctx.params).id, cookie(request), "invite");
  if (!a) return Response.json({ error: "not found" }, { status: 404 });
  const body = Remove.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Nothing to remove." }, { status: 400 });
  if ("token" in body.data) await revokeInvite(a.project.id, body.data.token);
  else if (a.role !== "owner") return Response.json({ error: "Only the owner can remove people." }, { status: 403 });
  else await removeMember(a.project.id, body.data.user);
  return Response.json({ ok: true });
}
