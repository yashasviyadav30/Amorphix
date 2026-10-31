import { entitiesById, insights, placesToTry, type Entity } from "../qloo/api.ts";
import { qloo } from "../qloo/client.ts";
import { updateProject, type Project } from "../project/store.ts";
import { runningOf } from "../interview/running.ts";
import { areaRank, categoriesFor, CROWDS, isKind, onePerChain, lookOf, NEAR, placeLook, runningHint, type Crowd } from "./read.ts";

// The neighbourhood read, fetched: the site on the map (once per address), the same kind of places around it
// ranked by Qloo for the owner's taste and crowd, and the city's taste heatmap. Every Qloo call is cached.

/** Where an address is, from OpenStreetMap. Only the address is sent; called once per project address. */
export async function geocode(location: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(location)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Amorphix/0.1 (amorphix.vercel.app)" }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const [hit] = (await res.json()) as { lat: string; lon: string }[];
  return hit ? { lat: Number(hit.lat), lon: Number(hit.lon) } : null;
}

/** Where the site is on the map: stored on the project, looked up once per address. */
export async function siteGeo(p: Project) {
  const loc = p.site.location!;
  if (p.site.geo?.for === loc) return p.site.geo;
  const g = await geocode(loc).catch(() => null);
  if (!g) return null;
  const geo = { ...g, for: loc };
  await updateProject(p.id, { site: { ...p.site, geo } }).catch(() => {});
  return geo;
}

type Cell = { location: { latitude: number; longitude: number; geohash: string }; query: { affinity?: number; affinity_rank?: number } };

/** The same kind of place near the point, widening the circle until a few turn up; best match for the taste first. */
async function nearby(type: string, cats: string[], geo: { lat: number; lon: number } | null, location: string, signal: Record<string, string | undefined>) {
  const found = new Map<string, Entity>();
  const add = (es: Entity[]) => es.forEach((e) => isKind(type, e) && !found.has(e.entity_id) && found.set(e.entity_id, e));
  const where = geo
    ? [1500, 3000, 6000].map((r) => ({ "filter.location": `POINT(${geo.lon} ${geo.lat})`, "filter.location.radius": r }))
    : placesToTry(location).map((q) => ({ "filter.location.query": q }));
  for (const w of where) {
    for (const tag of cats) add(await insights({ "filter.type": "urn:entity:place", "filter.tags": tag, ...w, ...signal, take: 20 }).catch(() => []));
    if (onePerChain([...found.values()]).length >= 4) break;
  }
  return onePerChain([...found.values()].sort((a, b) => (b.query?.affinity ?? 0) - (a.query?.affinity ?? 0))).slice(0, 6);
}

export type Neighbourhood = Awaited<ReturnType<typeof neighbourhoodOf>>;

export async function neighbourhoodOf(p: Project, crowd: Crowd) {
  const type = p.space_type ?? "";
  const location = p.site.location;
  if (!NEAR[type] || !location) return null;
  const likedIds = p.taste_signals.map((s) => s.entityId);
  const [geo, loved] = await Promise.all([siteGeo(p), entitiesById(p.taste_signals.filter((s) => s.layer !== 3).map((s) => s.entityId)).catch(() => [])]);
  const age = CROWDS[crowd].age;
  const signal = { "signal.interests.entities": likedIds.join(",") || undefined, "signal.demographics.age": age };
  const city = placesToTry(location).at(-1)!;
  const [places, cells] = await Promise.all([
    nearby(type, categoriesFor(type, loved), geo, location, signal),
    likedIds.length && geo
      ? // The area rank is for the owner's taste, not the crowd: one heatmap per project, so switching crowds stays quick.
        qloo<{ results?: { heatmap?: Cell[] } }>("/v2/insights", { "filter.type": "urn:heatmap", "filter.location.query": city, "signal.interests.entities": signal["signal.interests.entities"] })
          .then((d) => d.results?.heatmap ?? [])
          .catch(() => [])
      : Promise.resolve([] as Cell[]),
  ]);
  return {
    near: !!geo, // false: the places are across the city, not around the site
    where: geo ? location : city,
    city,
    what: NEAR[type].what,
    crowd,
    places: places.map((e) => ({
      id: e.entity_id,
      name: e.name,
      address: e.properties?.address ?? null,
      image: e.properties?.image?.url ?? null,
      match: e.query?.affinity !== undefined ? Math.round(e.query.affinity * 100) : null,
      look: placeLook(e),
    })),
    look: lookOf(places, p.taste?.tags ?? []),
    rank: geo ? areaRank(cells, geo.lat, geo.lon) : null,
    hint: runningHint(type, loved),
    said: { service: runningOf(p.interview).service ?? null, outdoor: runningOf(p.interview).outdoor ?? null },
  };
}
