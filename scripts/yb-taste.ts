// Loads the taste engine's vectors into YugabyteDB: the style words and the brand catalogue (measured from the
// catalogue's average), with HNSW indexes for cosine search. Safe to run again; it replaces the rows. Run:
//   node --env-file=.env.local scripts/yb-taste.ts
import vectors from "../lib/taste/vectors.json" with { type: "json" };
import { minus } from "../lib/taste/engine.ts";
import { asVector, CENTRE, yb } from "../lib/taste/yb.ts";

const sql = yb()!;
const dims = vectors.words[0].vector.length;
try {
  await sql`create extension if not exists vector`;
  await sql.unsafe(`create table if not exists taste_words (ord int primary key, family text not null, value text not null, vector vector(${dims}) not null)`);
  await sql.unsafe(`create table if not exists taste_brands (id text primary key, name text not null, aesthetic text[] not null, vector vector(${dims}) not null)`);
  await sql.begin(async (tx) => {
    await tx`delete from taste_words`;
    await tx`delete from taste_brands`;
    for (const [ord, w] of vectors.words.entries())
      await tx`insert into taste_words values (${ord}, ${w.family}, ${w.value}, ${asVector(w.vector)}::vector)`;
    for (const b of vectors.brands)
      await tx`insert into taste_brands values (${b.id}, ${b.name}, ${b.aesthetic}, ${asVector(minus(b.vector, CENTRE))}::vector)`;
  });
  await sql`create index if not exists taste_brands_hnsw on taste_brands using ybhnsw (vector vector_cosine_ops)`;
  await sql`create index if not exists taste_words_hnsw on taste_words using ybhnsw (vector vector_cosine_ops)`;
  const [{ w }] = await sql`select count(*)::int as w from taste_words`;
  const [{ b }] = await sql`select count(*)::int as b from taste_brands`;
  console.log(`taste_words ${w}, taste_brands ${b}, ${dims} dims`);
} finally {
  await sql.end();
}
