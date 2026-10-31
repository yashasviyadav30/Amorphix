"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The browser's Supabase client, used only to sign in (email link, Google, Apple). Data goes through our own routes.
let client: SupabaseClient | null = null;
export function supabaseBrowser() {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
    auth: { persistSession: false, detectSessionInUrl: true, flowType: "implicit" },
  });
  return client;
}
