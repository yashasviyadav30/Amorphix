// Prints a password-reset link for a test account, for testing /auth/reset without sending email.
// Run: node --env-file=.env.local scripts/recovery-link.ts <role>
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const email = `amorphix.test.${process.argv[2] ?? "owner"}@example.com`;
const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: "http://localhost:3000/auth/reset" } });
if (error) throw error;
console.log(data.properties.action_link);
