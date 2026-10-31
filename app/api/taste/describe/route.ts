import { whoOf } from "@/lib/auth/request";
import { chatModel } from "@/lib/models";
import { describe } from "@/lib/taste/describe";

// Turns the names someone loves into short design descriptions for the taste model to read (see lib/taste/describe).
export const maxDuration = 30;

export async function POST(request: Request) {
  const { guestId, userId } = await whoOf(request.headers.get("cookie"));
  if (!guestId && !userId) return Response.json({ error: "Please reload the page and try again." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { names?: unknown } | null;
  try {
    return Response.json({ items: await describe(body?.names, chatModel()) });
  } catch {
    return Response.json({ error: "Couldn't read those just now. Try again in a moment." }, { status: 502 });
  }
}
