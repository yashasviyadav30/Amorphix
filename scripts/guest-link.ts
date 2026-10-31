// Prints a link that reopens a guest's projects in another browser (signed with the server secret).
// Run: node --env-file=.env.local --env-file=.env scripts/guest-link.ts <project id> [base url]
import { createClient } from "@supabase/supabase-js";
import { signGuest } from "../lib/auth/guest.ts";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data, error } = await db.from("projects").select("guest_id").eq("id", process.argv[2]).single();
if (error || !data.guest_id) throw error ?? new Error("that project has no guest");
const token = await signGuest(data.guest_id, process.env.AMORPHIX_SESSION_SECRET!);
console.log(`${process.argv[3] ?? "http://localhost:3000"}/api/claim?t=${encodeURIComponent(token)}&next=/`);
