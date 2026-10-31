import { z } from "zod";
import { guestOf } from "@/lib/auth/request";
import { search } from "@/lib/qloo/api";
import { layerOf } from "@/lib/qloo/taste";
import { profileFor } from "@/lib/qloo/profile";
import { confirmPick } from "@/lib/plan-import/taste";
import { cardWords, profileSummary } from "@/lib/interview/logic";
import { styleOf } from "@/lib/three/materials";
import { STYLE_NAME } from "@/lib/quiz/picks";

// The live "Your taste so far" card: the picks made so far in the interview, read through Qloo into style words
// and matching brands. Only for showing; the finish route confirms the picks again before anything is saved.
const Body = z.object({
  picks: z.array(z.object({ slot: z.enum(["place", "brand", "media"]), id: z.string().min(1), name: z.string().min(1).max(120) })).min(1).max(5),
});

export async function POST(request: Request) {
  if (!(await guestOf(request.headers.get("cookie")))) return Response.json({ error: "Please reload the page and try again." }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Nothing to read yet." }, { status: 400 });
  try {
    const found = await Promise.all(body.data.picks.map((p) => confirmPick(p, search)));
    const signals = found.map((e) => ({ entityId: e.entity_id, name: e.name, layer: layerOf(e), type: e.types?.[0] }));
    const profile = await profileFor(signals, new Map(found.map((e) => [e.entity_id, e])));
    return Response.json({ ...profileSummary(profile, 16, 4), count: found.length, words: cardWords(profile), family: STYLE_NAME[styleOf(profile, "").style] });
  } catch {
    return Response.json({ error: "Couldn't read your taste just now." }, { status: 502 });
  }
}
