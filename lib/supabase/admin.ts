import { createClient } from "@supabase/supabase-js";

// Server-only client with the service role. Never import this from a client component.
export const supabaseAdmin = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
