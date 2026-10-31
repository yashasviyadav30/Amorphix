// Gives projects that a test account claimed from a browser back to that browser (owner cleared, guest id kept),
// so they move into the real account when its owner signs in. Run: node --env-file=.env.local scripts/release-test-projects.ts
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
const tests = list.users.filter((u) => u.email?.startsWith("amorphix.test.")).map((u) => u.id);
const { data, error } = await db.from("projects").update({ owner_id: null }).in("owner_id", tests).not("guest_id", "is", null).select("id, title");
if (error) throw error;
console.log("released", data.map((p) => p.title));
