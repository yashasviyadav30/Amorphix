import { userOf } from "@/lib/auth/request";
import { getProfile } from "@/lib/account/profile";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Who is signed in, for the header menu. A guest gets { user: null }.
export async function GET(request: Request) {
  const userId = await userOf(request.headers.get("cookie"));
  if (!userId) return Response.json({ user: null });
  const [profile, { data }] = await Promise.all([getProfile(userId), supabaseAdmin().auth.admin.getUserById(userId)]);
  if (!data.user) return Response.json({ user: null });
  return Response.json({ user: { id: userId, email: data.user.email ?? null }, profile });
}
