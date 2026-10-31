import { NextResponse } from "next/server";
import { GUEST_COOKIE, verifyGuest } from "@/lib/auth/guest";

// Open your project on another browser: a link carrying your signed guest id sets it here.
// Only ids signed with the server secret are accepted, and the redirect stays on this site.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  const next = url.searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const id = await verifyGuest(token, process.env.AMORPHIX_SESSION_SECRET ?? "");
  if (!id || !token) return NextResponse.redirect(new URL("/", url));
  const res = NextResponse.redirect(new URL(safeNext, url));
  res.cookies.set(GUEST_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
