"use client";

// Swaps a Supabase access token for Amorphix's own signed cookie, then goes where the server says
// (new accounts first pick their role). Returns an error message, or never returns because the page moves on.
export async function startSession(token: string, next: string): Promise<string> {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ access_token: token, next }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return body.error ?? "Sign-in failed. Please try again.";
  window.location.replace(body.next);
  return await new Promise<string>(() => {});
}

/** The rules a new password must meet, as one message, or null when it is fine. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Use at least 8 characters.";
  if (pw.length > 72) return "Use 72 characters or fewer.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Use at least one letter and one number.";
  return null;
}
