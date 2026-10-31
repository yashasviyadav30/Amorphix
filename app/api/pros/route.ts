import { z } from "zod";
import { accessTo } from "@/lib/auth/request";
import { prosFor } from "@/lib/pros/directory";

const Query = z.object({ project: z.uuid(), role: z.enum(["architect", "builder"]).default("architect") });

// Pros a project's owner could bring in, best taste fit first.
export async function GET(request: Request) {
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return Response.json({ error: "Which project?" }, { status: 400 });
  const a = await accessTo(q.data.project, request.headers.get("cookie"), "invite");
  if (!a) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ pros: await prosFor(a.project, q.data.role), title: a.project.title, city: a.project.site?.location ?? null });
}
