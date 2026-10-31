// Copies a finished project into a test account, for testing teams and review without touching the original.
// Run: node --env-file=.env.local scripts/copy-project.ts <project id> <test role> [title]
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const [id, role = "owner", title] = process.argv.slice(2);
const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
const owner = list.users.find((u) => u.email === `amorphix.test.${role}@example.com`);
if (!owner) throw new Error(`no test ${role} account; run scripts/test-users.ts ${role} first`);
const { data: src, error } = await db.from("projects").select().eq("id", id).single();
if (error) throw error;
const { id: _id, created_at: _c, updated_at: _u, guest_id: _g, ...rest } = src;
const { data: copy, error: e2 } = await db.from("projects").insert({ ...rest, owner_id: owner.id, guest_id: null, title: title ?? `${src.title} (test)` }).select("id, title").single();
if (e2) throw e2;
console.log(copy.id, copy.title);
