import { NextResponse } from "next/server";
import { userOf } from "@/lib/auth/request";
import { deleteAccount } from "@/lib/account/erase";
import { GUEST_COOKIE, USER_COOKIE } from "@/lib/auth/guest";

// Deletes the signed-in account and the projects it owns, then signs out. The page asks them to type DELETE first;
// the same word is required here, so a stray request can't do it.
export async function DELETE(request: Request) {
  const userId = await userOf(request.headers.get("cookie"));
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== "DELETE") return Response.json({ error: "Type DELETE to confirm." }, { status: 400 });
  await deleteAccount(userId);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(USER_COOKIE);
  res.cookies.delete(GUEST_COOKIE);
  return res;
}
