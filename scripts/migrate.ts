// Applies db/migrations/*.sql in name order, once each. Run: node --env-file=.env.local scripts/migrate.ts
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING!, { ssl: "require", max: 1 });
const dir = new URL("../db/migrations/", import.meta.url);

await sql`create table if not exists _migrations (name text primary key, applied_at timestamptz default now())`;
// Row-level security on, no policies: only the database owner (this script) can touch it, not the public API.
await sql`alter table _migrations enable row level security`;
const done = new Set((await sql`select name from _migrations`).map((r) => r.name));

for (const name of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(name)) continue;
  await sql.begin(async (tx) => {
    await tx.unsafe(readFileSync(new URL(name, dir), "utf8"));
    await tx`insert into _migrations (name) values (${name})`;
  });
  console.log(`applied ${name}`);
}
await sql.end();
