import { bindSession, createProject, projectForSession, type Project } from "../../../../lib/project/store.ts";

type SessionCtx = { session: { id: string; auth: { initiator?: { principalId?: string; authenticator?: string } | null } } };

// The project this session works on. The first tool call of a new interview creates it,
// owned by the guest who started the session, and binds the session to it.
export async function sessionProject(ctx: SessionCtx): Promise<Project> {
  try {
    return await projectForSession(ctx.session.id);
  } catch {
    const who = ctx.session.auth.initiator;
    const guestId = who?.authenticator === "amorphix-guest" ? who.principalId : null;
    const p = await createProject({ guest_id: guestId ?? null });
    await bindSession(ctx.session.id, p.id, "interviewer");
    return p;
  }
}
