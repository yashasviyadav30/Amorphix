// For showing every role's home side by side on the local server: writes a signed session for each test role
// (owner, business owner, architect, builder) to a JSON file outside the repo. Local use only; the values are test
// sessions for localhost, never typed into the live site.
// Run: node --env-file=.env.local --env-file=.env scripts/role-sessions.ts <out.json>
// Then in four tabs (each host keeps its own cookies): localhost:3000 (owner, a house), 127.0.0.1:3000 (owner, the
// Brooklyn café), [::1]:3000 (architect), builder.localhost:3000 (builder). On each, on any page:
// document.cookie = "amorphix_user=<value>; path=/; samesite=lax", then open /home.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { signUser } from "../lib/auth/guest.ts";

const out = process.argv[2];
if (!out) throw new Error("Give the file to write, outside the repo.");
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data } = await db.auth.admin.listUsers({ perPage: 200 });
const sessions: Record<string, string> = {};
for (const role of ["owner", "business", "architect", "builder"]) {
  const u = data.users.find((x) => x.email === `amorphix.test.${role}@example.com`);
  if (u) sessions[role] = await signUser(u.id, process.env.AMORPHIX_SESSION_SECRET!);
}
writeFileSync(out, JSON.stringify(sessions));
console.log("wrote", Object.keys(sessions).join(", "));
