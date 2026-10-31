import postgres from "postgres";
import vectors from "./vectors.json" with { type: "json" };
import { centreOf, minus, tasteVector, type Signal, type Sims } from "./engine.ts";
import type { Family } from "./types.ts";

// The taste engine's vector store on YugabyteDB (pgvector): the style words and the brand catalogue as rows, with an
// HNSW index on the brands, so the brands nearest a taste are a nearest-neighbour query. `scripts/yb-taste.ts` loads
// the rows from vectors.json; brands are stored measured from the catalogue's average (see centreOf in engine.ts).

export const CENTRE = centreOf(vectors.brands.map((b) => b.vector));
export const asVector = (v: number[]) => `[${v.join(",")}]`;

let client: postgres.Sql | null = null;
export function yb(url = process.env.YUGABYTE_URL) {
  if (!url) return null;
  return (client ??= postgres(url, { ssl: "require", max: 4, connect_timeout: 5, idle_timeout: 30, onnotice: () => {} }));
}

type WordRow = { family: Family; value: string };

/** Every similarity the profile needs, worked out by YugabyteDB in four queries, however many inputs there are. */
export async function simsFromYb(sql: postgres.Sql, signals: Signal[], take = 12): Promise<{ words: WordRow[]; sims: Sims }> {
  const taste = asVector(minus(tasteVector(signals), CENTRE));
  const raw = signals.map((s) => asVector(s.vector));
  const centred = signals.map((s) => asVector(minus(s.vector, CENTRE)));
  const [words, nearest, wordSims, brandSims] = await Promise.all([
    sql<WordRow[]>`select family, value from taste_words order by ord`,
    sql<Sims["nearest"]>`select id, name, aesthetic, 1 - (vector <=> ${taste}::vector) as affinity
      from taste_brands order by vector <=> ${taste}::vector limit ${take}`,
    sql<{ i: number; sim: number }[]>`select s.i::int as i, 1 - (w.vector <=> s.v::vector) as sim
      from unnest(${raw}::text[]) with ordinality as s(v, i) cross join taste_words w order by s.i, w.ord`,
    sql<{ i: number; id: string; sim: number }[]>`select s.i::int as i, b.id, 1 - (b.vector <=> s.v::vector) as sim
      from unnest(${centred}::text[]) with ordinality as s(v, i) cross join taste_brands b`,
  ]);
  const perWord = signals.map(() => [] as number[]);
  for (const r of wordSims) perWord[r.i - 1].push(Number(r.sim));
  const perBrand = signals.map(() => new Map<string, number>());
  for (const r of brandSims) perBrand[r.i - 1].set(r.id, Number(r.sim));
  return {
    words: [...words],
    sims: { words: perWord, nearest: nearest.map((b) => ({ ...b, affinity: Number(b.affinity) })), brands: perBrand },
  };
}
