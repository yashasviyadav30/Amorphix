import { z } from "zod";
import { accessTo, whoOf } from "@/lib/auth/request";
import { createProject, deleteProject, updateProject } from "@/lib/project/store";
import { missingForDesign } from "@/lib/interview/logic";
import { problems, toProject, type Answers } from "@/lib/interview/script";
import { nameOf, postEvent } from "@/lib/project/thread";
import { JUDGE_COOKIE } from "@/lib/demo/ids";
import { readCookie } from "@/lib/auth/guest";

// The scripted interview's last step: the browser sends every answer and the taste its model read on the device
// (from the names and photos they love), this checks both and creates the project ready to design.
export const maxDuration = 60;

const Body = z.object({
  answers: z.record(z.string(), z.unknown()),
  lang: z.enum(["en", "hi", "hinglish"]).default("en"),
  // A project a pro created for a client ("New client"): the answers fill it instead of making a new one.
  projectId: z.uuid().optional(),
  taste: z.object({
    signals: z.array(z.object({ entityId: z.string().max(120), name: z.string().max(120), layer: z.union([z.literal(1), z.literal(2), z.literal(3)]), type: z.string().max(20).optional() })).min(1).max(12),
    profile: z.object({
      tags: z.array(
        z.object({
          family: z.enum(["decor", "ambience", "aesthetic", "tone", "style"]),
          value: z.string().max(60),
          weight: z.number(),
          sources: z.array(z.object({ entityId: z.string().max(120), name: z.string().max(120), layer: z.union([z.literal(1), z.literal(2), z.literal(3)]) })).max(12),
        }),
      ).max(200),
      brands: z.array(z.object({ id: z.string().max(80), name: z.string().max(80), affinity: z.number(), aesthetic: z.array(z.string().max(60)).max(10), because: z.array(z.object({ entityId: z.string().max(120), score: z.number() })).max(12) })).max(40),
    }),
  }),
});

export async function POST(request: Request) {
  const { guestId, userId } = await whoOf(request.headers.get("cookie"));
  if (!guestId && !userId) return Response.json({ error: "Please reload the page and try again." }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Something went wrong with your answers. Please start again." }, { status: 400 });
  const answers = body.data.answers as Answers;
  // a judge trying Amorphix after the tour gets their design in full (see /demo?exit=start)
  const judge = readCookie(request.headers.get("cookie"), JUDGE_COOKIE) === "1";
  // Filling a pro's project: only its owner (the architect or builder) or its client, and only while it waits.
  const into = body.data.projectId ? await accessTo(body.data.projectId, request.headers.get("cookie")) : null;
  if (body.data.projectId && (!into || into.project.status !== "interview" || !["owner", "architect", "client"].includes(into.role)))
    return Response.json({ error: "This project isn't waiting for answers." }, { status: 409 });
  const wrong = problems(answers);
  if (wrong.length) return Response.json({ error: "Some answers are missing. Please go back and check them.", problems: wrong }, { status: 400 });

  const { signals, profile: taste } = body.data.taste;

  const fields = { ...toProject(answers, body.data.lang), status: "designing" as const, taste_signals: signals, taste };
  const p = into
    ? await updateProject(into.project.id, { ...fields, title: into.project.title ?? fields.title })
    : await createProject({ ...fields, guest_id: guestId, owner_id: userId, ...(judge ? { unlocked_at: new Date().toISOString() } : {}) });
  // The script is built to always meet what the design needs; if it ever doesn't, that's a bug, not the user's.
  const missing = missingForDesign(p);
  if (missing.length) {
    console.error("scripted interview left gaps:", missing);
    if (!into) await deleteProject(p.id);
    return Response.json({ error: "We couldn't start your design. Please try again." }, { status: 500 });
  }
  // the client answered a pro's project: the pro's cue to start, told in the thread and the bell
  if (into && into.role === "client" && userId) await postEvent(p, { id: userId, name: await nameOf(userId) }, { type: "answered" }).catch(() => {});
  return Response.json({ id: p.id });
}
