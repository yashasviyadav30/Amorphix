import { userOf } from "./request.ts";

/** The signed-in user's id, or a 401 response to send back. */
export async function requireUser(request: Request): Promise<{ userId: string } | { error: Response }> {
  const userId = await userOf(request.headers.get("cookie"));
  return userId ? { userId } : { error: Response.json({ error: "Please sign in first." }, { status: 401 }) };
}
