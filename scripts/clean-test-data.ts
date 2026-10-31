// Clears leftovers from testing: projects the test accounts own that never got past the interview, plus anything named
// as a test, keeping the projects the live checks and the film use. Real visitors' projects are never touched: only
// projects owned by amorphix.test.*@example.com are considered.
// Run: node --env-file=.env.local --env-file=.env scripts/clean-test-data.ts          (lists what would go)
//      node --env-file=.env.local --env-file=.env scripts/clean-test-data.ts --yes    (deletes it)
import { createClient } from "@supabase/supabase-js";

const KEEP = new Set([
  "2ec977ae-e718-430e-89a9-44afeff12b4e", // live checks: a house being built
  "6aa147ed-2d22-4cd9-b093-9e76b912a4ce", // live checks: the café
  "2418b263-5bff-43b4-a762-2f5d76e22ac2", // live checks: the self-build
  "ab285435-ac14-4fab-9a02-2659470050f0", // the film: the house in design
  "690edf0d-556e-45ac-85d4-e3c048287149", // the film: the house moved in
  "6c3c535f-0c33-45d6-be65-f0b6d8899b78", // the film: the client's approved design
  "90412e56-604e-428b-beb7-740aecb77009", // the film: the Brooklyn café
]);

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
const testers = new Map((users?.users ?? []).filter((u) => /^amorphix\.test\.[a-z]+@example\.com$/.test(u.email ?? "")).map((u) => [u.id, u.email!.split(".")[2].split("@")[0]]));
const { data: projects } = await db.from("projects").select("id, title, status, owner_id, created_at").in("owner_id", [...testers.keys()]).order("created_at");

const gone = (projects ?? []).filter((p) => !KEEP.has(p.id) && (p.status === "interview" || /\b(test|pune|delhi)\b/i.test(p.title ?? "")));
for (const p of projects ?? []) console.log(gone.includes(p) ? "DELETE" : "keep  ", p.id.slice(0, 8), testers.get(p.owner_id!), p.status.padEnd(10), p.title);
console.log(`${gone.length} of ${projects?.length ?? 0} test projects would go`);
if (process.argv.includes("--yes") && gone.length) {
  const { error } = await db.from("projects").delete().in("id", gone.map((p) => p.id));
  console.log(error ? `failed: ${error.message}` : `deleted ${gone.length}`);
}
