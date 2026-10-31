import { search, type Entity } from "@/lib/qloo/api";
import { layerOf } from "@/lib/qloo/taste";
import { profileFor } from "@/lib/qloo/profile";
import { cardWords } from "@/lib/interview/logic";
import { styleOf } from "@/lib/three/materials";
import { sameName, STYLE_NAME } from "@/lib/quiz/picks";

// The landing page's live strip: three pairs of loves, each read by Qloo right now into a style, its words (each
// with the love it came from) and the brands it points to. Qloo's answers are cached server side, never in the repo.

const EXAMPLES: { space: string; loves: [string, string][] }[] = [
  { space: "A home", loves: [["The Grand Budapest Hotel", "urn:entity:movie"], ["Aman Tokyo", "urn:entity:place"]] },
  { space: "A café", loves: [["Frank Ocean", "urn:entity:artist"], ["Blue Bottle Coffee", "urn:entity:brand"]] },
  { space: "An office", loves: [["Succession", "urn:entity:tv_show"], ["Soho House New York", "urn:entity:place"]] },
];

async function find(name: string, types: string): Promise<Entity | null> {
  const hit = (await search(name, 1, types).catch(() => []))[0];
  return hit && sameName(name, hit.name) ? hit : null;
}

async function read(ex: (typeof EXAMPLES)[number]) {
  const found = await Promise.all(ex.loves.map(([n, t]) => find(n, t)));
  if (found.some((e) => !e)) return null;
  const es = found as Entity[];
  const taste = await profileFor(
    es.map((e) => ({ entityId: e.entity_id, name: e.name, layer: layerOf(e) })),
    new Map(es.map((e) => [e.entity_id, e])),
  );
  return {
    space: ex.space,
    loves: es.map((e) => ({ name: e.name, image: e.properties?.image?.url ?? null })),
    style: STYLE_NAME[styleOf(taste, "").style],
    words: cardWords(taste).slice(0, 4),
    brands: taste.brands.slice(0, 3).map((b) => b.name),
  };
}

export async function GET() {
  const reads = (await Promise.all(EXAMPLES.map((ex) => read(ex).catch(() => null)))).filter(Boolean);
  // the page falls back to a written example when Qloo can't answer
  if (!reads.length) return Response.json({ reads: [] }, { status: 502 });
  return Response.json({ reads }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
