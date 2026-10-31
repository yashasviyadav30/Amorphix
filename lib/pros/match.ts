// How well a pro fits a client's taste: the client's Qloo style tags against the tags of the projects the pro has
// designed on Amorphix. Cosine similarity of the weighted tags, shown as a percentage, plus the words they share.
// Pure, so it can be tested and explained.

type Tag = { family: string; value: string; weight: number };
type Taste = { tags: Tag[] } | null | undefined;

const key = (t: Tag) => `${t.family}:${t.value}`;
/** "mid_century_modern" → "mid century modern" */
export const word = (value: string) => value.replace(/[_-]+/g, " ").trim();

/** One weighted vector from one or more taste profiles (a pro's projects add up). */
export function vectorOf(tastes: Taste[]): Map<string, number> {
  const v = new Map<string, number>();
  for (const t of tastes) for (const tag of t?.tags ?? []) v.set(key(tag), (v.get(key(tag)) ?? 0) + tag.weight);
  return v;
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [k, x] of a) dot += x * (b.get(k) ?? 0);
  const norm = (m: Map<string, number>) => Math.sqrt([...m.values()].reduce((s, x) => s + x * x, 0));
  const n = norm(a) * norm(b);
  return n ? dot / n : 0;
}

const city = (s: string | null | undefined) => (s ?? "").split(",")[0].trim().toLowerCase();

export type Fit = { score: number; shared: string[]; sameCity: boolean; hasWork: boolean };

/**
 * The fit of one pro for one client. A pro with no Amorphix projects yet has no style to compare, so they get a
 * neutral 50 and say so (`hasWork`). The same city adds a little, never more than taste does.
 */
export function fitOf(client: Taste, clientCity: string | null | undefined, pro: { tastes: Taste[]; city: string | null }): Fit {
  const sameCity = !!city(clientCity) && city(clientCity) === city(pro.city);
  const a = vectorOf([client]);
  const b = vectorOf(pro.tastes);
  const hasWork = b.size > 0;
  const shared = [...a.keys()]
    .filter((k) => b.has(k))
    .sort((x, y) => (a.get(y)! * b.get(y)!) - (a.get(x)! * b.get(x)!))
    .slice(0, 3)
    .map((k) => word(k.split(":").slice(1).join(":")));
  const taste = hasWork && a.size ? cosine(a, b) : 0.5;
  return { score: Math.round(Math.min(1, taste * 0.9 + (sameCity ? 0.1 : 0)) * 100), shared, sameCity, hasWork };
}

/** Best fit first; ties go to the same city, then to pros with work to show. */
export function rank<T extends { fit: Fit }>(pros: T[]): T[] {
  return [...pros].sort((x, y) => y.fit.score - x.fit.score || Number(y.fit.sameCity) - Number(x.fit.sameCity) || Number(y.fit.hasWork) - Number(x.fit.hasWork));
}
