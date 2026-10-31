import { requireUser } from "@/lib/auth/user";
import { ProfileInput, saveProfile } from "@/lib/account/profile";

export async function PUT(request: Request) {
  const who = await requireUser(request);
  if ("error" in who) return who.error;
  const body = ProfileInput.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: body.error.issues[0]?.message ?? "Please check the form." }, { status: 400 });
  return Response.json(await saveProfile(who.userId, body.data));
}
