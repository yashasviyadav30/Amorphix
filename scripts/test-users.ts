// Creates (or reuses) the test accounts Vicky approved (password from AMORPHIX_TEST_PASSWORD) and prints a magic link.
// Run: node --env-file=.env.local scripts/test-users.ts <role> <redirect>
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const role = process.argv[2] ?? "owner";
const redirectTo = process.argv[3] ?? "http://localhost:3000/auth/callback?next=/home";
const email = `amorphix.test.${role}@example.com`;

const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
const password = process.env.AMORPHIX_TEST_PASSWORD; // lives in .env.local only
const existing = list.users.find((u) => u.email === email);
if (!existing) {
  const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  console.log("created", email);
} else if (password) await db.auth.admin.updateUserById(existing.id, { password });
const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
if (error) throw error;
console.log(data.properties.action_link);
