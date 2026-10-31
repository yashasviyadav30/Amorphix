import { z } from "zod";
import { whoOf } from "@/lib/auth/request";
import vectors from "@/lib/taste/vectors.json";
import { buildProfile, profileFrom } from "@/lib/taste/engine";
import { simsFromYb, yb } from "@/lib/taste/yb";

// The taste profile from the vectors a browser made (CLIP, on the device): the style words each input stands out for
// and the brands nearest the whole taste, worked out by YugabyteDB's vector search. If the database is slow or away,
// the same engine runs in memory, so a taste is never lost.
export const maxDuration = 30;

const DIMS = vectors.words[0].vector.length;
const Body = z.object({
  signals: z.array(z.object({
    source: z.object({ entityId: z.string().max(120), name: z.string().max(120), layer: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
    vector: z.array(z.number().finite()).length(DIMS),
  })).min(1).max(13),
  take: z.number().int().min(1).max(30).default(12),
});

const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error("timed out")), ms))]);

export async function POST(request: Request) {
  const { guestId, userId } = await whoOf(request.headers.get("cookie"));
  if (!guestId && !userId) return Response.json({ error: "Please reload the page and try again." }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "That taste couldn't be read." }, { status: 400 });
  const { signals, take } = body.data;
  const sql = yb();
  if (sql)
    try {
      const { words, sims } = await within(simsFromYb(sql, signals, take), 5000);
      return Response.json({ profile: profileFrom(signals, words, sims), engine: "yugabytedb" });
    } catch (e) {
      console.error("taste profile: vector store unavailable, using memory", e instanceof Error ? e.message : e);
    }
  return Response.json({ profile: buildProfile(signals, vectors.words as never, vectors.brands, take), engine: "memory" });
}
