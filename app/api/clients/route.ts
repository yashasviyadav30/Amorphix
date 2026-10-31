import { z } from "zod";
import { requireUser } from "@/lib/auth/user";
import { getProfile } from "@/lib/account/profile";
import { createProject } from "@/lib/project/store";
import { createInvite } from "@/lib/project/team";
import { proActive } from "@/lib/project/unlock";
import { SpaceType } from "@/lib/layout/schema";

const WORD: Record<string, string> = { house: "house", apartment: "home", studio: "studio", cafe: "café", office: "office", shop: "shop", hotel: "hotel" };

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  spaceType: SpaceType,
  city: z.string().trim().min(1).max(80),
  link: z.boolean().default(false),
});

// "New client": an architect or builder starts a project for a client. It belongs to the pro (their plan carries
// it) and is named for the client ("Priya's house"). With `link`, the client gets an invite that leads them
// straight to Let's get to know you.
export async function POST(request: Request) {
  const who = await requireUser(request);
  if ("error" in who) return who.error;
  const profile = await getProfile(who.userId);
  if (!profile || (profile.role !== "architect" && profile.role !== "builder")) return Response.json({ error: "New clients are for architects and builders." }, { status: 403 });
  if (!proActive(profile)) return Response.json({ error: "Your trial has ended. Pick a plan to start new client projects." }, { status: 402 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Add the client's name, the kind of project and the city." }, { status: 400 });
  const { name, spaceType, city, link } = body.data;
  const p = await createProject({
    owner_id: who.userId,
    mode: "pro",
    status: "interview",
    designed_for: name,
    space_type: spaceType,
    title: `${name.split(/\s+/)[0]}'s ${WORD[spaceType]}`,
    site: { location: city, units: profile.units },
  });
  if (!link) return Response.json({ id: p.id }, { status: 201 });
  const invite = await createInvite(p.id, { userId: who.userId, role: "owner" }, "client");
  return Response.json({ id: p.id, token: invite.token }, { status: 201 });
}
