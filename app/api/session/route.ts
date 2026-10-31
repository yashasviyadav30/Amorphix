import { NextResponse } from "next/server";
import { z } from "zod";
import { whoOf } from "@/lib/auth/request";
import { GUEST_COOKIE, signUser, USER_COOKIE } from "@/lib/auth/guest";
import { claimGuestProjects, getProfile, safeNext } from "@/lib/account/profile";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ access_token: z.string().min(20).max(4000), next: z.string().max(500).optional() });
const MONTH = 60 * 60 * 24 * 30;

function sameSite(request: Request) {
  try {
    return new URL(request.headers.get("origin") ?? "").host === new URL(request.url).host;
  } catch {
    return false;
  }
}

// Sign in: the browser hands over the token Supabase gave it after the email link, Google or Apple. We check it
// with Supabase, then keep our own signed cookie, so pages and routes know the user without calling Supabase again.
// ponytail: the cookie lasts 30 days and isn't revoked when the Supabase session ends; check it against Supabase if that matters.
export async function POST(request: Request) {
  // Only this site's own pages may sign someone in (stops another site logging a visitor into a stranger's account).
  if (!sameSite(request)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Sign-in failed. Please try again." }, { status: 400 });
  const { data, error } = await supabaseAdmin().auth.getUser(body.data.access_token);
  if (error || !data.user) return Response.json({ error: "That sign-in link has expired. Please try again." }, { status: 401 });
  const userId = data.user.id;
  const { guestId } = await whoOf(request.headers.get("cookie"));
  const [claimed, profile] = await Promise.all([claimGuestProjects(userId, guestId), getProfile(userId)]);
  const next = safeNext(body.data.next);
  const res = NextResponse.json({ next: profile ? next : `/welcome?next=${encodeURIComponent(next)}`, claimed });
  res.cookies.set(USER_COOKIE, await signUser(userId, process.env.AMORPHIX_SESSION_SECRET ?? ""), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MONTH,
  });
  return res;
}

// Sign out. The guest cookie goes too, so this browser starts fresh and can't reopen the account's projects.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(USER_COOKIE);
  res.cookies.delete(GUEST_COOKIE);
  return res;
}
