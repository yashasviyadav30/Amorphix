import { insights, placesToTry, type Entity } from "../qloo/api.ts";
import type { Project } from "../project/store.ts";
import { siteGeo } from "../neighbourhood/fetch.ts";
import { onePerChain } from "../neighbourhood/read.ts";
import { isGallery, kindOf, listenAt, playlistSignals } from "./read.ts";

// Art and sound, fetched: galleries and museums near the site ranked for the client's taste, and artists matched
// to the places, films and music they love. Every Qloo call is cached.

async function galleries(p: Project, liked: string[]) {
  const location = p.site.location;
  if (!location) return [];
  const geo = await siteGeo(p).catch(() => null);
  const where = geo
    ? [3000, 8000, 20000].map((r) => ({ "filter.location": `POINT(${geo.lon} ${geo.lat})`, "filter.location.radius": r }))
    : placesToTry(location).map((q) => ({ "filter.location.query": q }));
  const found = new Map<string, Entity>();
  for (const w of where) {
    for (const tag of ["art_gallery", "museum"]) {
      const es = await insights({ "filter.type": "urn:entity:place", "filter.tags": `urn:tag:category:place:${tag}`, ...w, "signal.interests.entities": liked.join(",") || undefined, take: 12 }).catch(() => []);
      for (const e of es) if (isGallery(e) && !found.has(e.entity_id)) found.set(e.entity_id, e);
    }
    if (found.size >= 3) break;
  }
  const ranked = onePerChain([...found.values()].sort((a, b) => (b.query?.affinity ?? 0) - (a.query?.affinity ?? 0)));
  // Galleries first (work there can be bought), then museums, best match first within each.
  return [...ranked.filter((e) => kindOf(e) === "gallery"), ...ranked.filter((e) => kindOf(e) === "museum")].slice(0, 4).map((e) => ({
    name: e.name,
    kind: kindOf(e),
    address: e.properties?.address ?? null,
    match: e.query?.affinity !== undefined ? Math.round(e.query.affinity * 100) : null,
  }));
}

async function playlist(p: Project) {
  const signals = playlistSignals(p.taste_signals);
  if (!signals.length) return [];
  // well-known artists, leaning toward what's heard where they live (a house in Los Angeles shouldn't get a
  // playlist of Russian pop because of one hotel)
  const ask = (near: boolean) =>
    insights({ "filter.type": "urn:entity:artist", "signal.interests.entities": signals.join(","), "filter.popularity.min": 0.8, ...(near && p.site.location ? { "signal.location.query": p.site.location } : {}), take: 10 }).catch(() => []);
  const near = await ask(true);
  const artists = (near.length ? near : await ask(false)).filter((a) => !/[\u0400-\u04FF]/.test(a.name)).slice(0, 6);
  return artists.map((a) => ({ name: a.name, image: a.properties?.image?.url ?? null, listen: listenAt(a.name) }));
}

export type ArtAndSound = Awaited<ReturnType<typeof artAndSound>>;

export async function artAndSound(p: Project) {
  const [art, music] = await Promise.all([galleries(p, p.taste_signals.map((s) => s.entityId)), playlist(p)]);
  return { art, music, near: p.site.location ?? null, because: p.taste_signals.filter((s) => s.type !== "urn:entity:brand").map((s) => s.name) };
}
