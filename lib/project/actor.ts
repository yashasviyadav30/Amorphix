import { userOf } from "../auth/request.ts";
import { nameOf } from "./thread.ts";

/** Who did something, for the thread: the signed-in person by name, or "The owner" for a guest's own project. */
export async function actorOf(cookieHeader: string | null): Promise<{ id: string | null; name: string }> {
  const id = await userOf(cookieHeader);
  return id ? { id, name: await nameOf(id) } : { id: null, name: "The owner" };
}
