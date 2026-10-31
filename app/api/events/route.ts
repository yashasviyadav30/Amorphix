import { z } from "zod";
import { requireUser } from "@/lib/auth/user";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The bell: this person's latest notifications and how many are unread.
export async function GET(request: Request) {
  const who = await requireUser(request);
  if ("error" in who) return who.error;
  const db = supabaseAdmin();
  const [{ data }, { count }] = await Promise.all([
    db.from("events").select("id, project_id, kind, data, read, created_at").eq("user_id", who.userId).order("created_at", { ascending: false }).limit(40),
    db.from("events").select("id", { count: "exact", head: true }).eq("user_id", who.userId).eq("read", false),
  ]);
  return Response.json({ events: data ?? [], unread: count ?? 0 });
}

const Read = z.object({ ids: z.array(z.number().int()).max(100).optional() });

// Mark notifications read: the listed ones, or all of them.
export async function POST(request: Request) {
  const who = await requireUser(request);
  if ("error" in who) return who.error;
  const body = Read.safeParse(await request.json().catch(() => ({})));
  let q = supabaseAdmin().from("events").update({ read: true }).eq("user_id", who.userId).eq("read", false);
  if (body.success && body.data.ids?.length) q = q.in("id", body.data.ids);
  await q;
  return Response.json({ ok: true });
}
