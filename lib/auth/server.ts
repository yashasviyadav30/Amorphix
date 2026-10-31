import { cookies } from "next/headers";
import { USER_COOKIE, verifyUser } from "./guest.ts";

/** The signed-in user's id in a server component, or null. */
export async function currentUser(): Promise<string | null> {
  return verifyUser((await cookies()).get(USER_COOKIE)?.value, process.env.AMORPHIX_SESSION_SECRET ?? "");
}
