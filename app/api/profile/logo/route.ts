import { requireUser } from "@/lib/auth/user";
import { setLogo } from "@/lib/account/profile";
import { supabaseAdmin } from "@/lib/supabase/admin";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_BYTES = 1024 * 1024;

// The studio or company logo: stored in the public logos bucket under a fresh name, so old copies never linger in caches.
export async function POST(request: Request) {
  const who = await requireUser(request);
  if ("error" in who) return who.error;
  const file = (await request.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a logo to upload." }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: "Upload a PNG, JPG or WebP logo." }, { status: 415 });
  if (file.size > MAX_BYTES) return Response.json({ error: "That logo is over 1 MB. Try a smaller file." }, { status: 413 });
  const storage = supabaseAdmin().storage.from("logos");
  const path = `${who.userId}/${Date.now()}.${ext}`;
  const { error } = await storage.upload(path, file, { contentType: file.type });
  if (error) return Response.json({ error: "Upload failed. Please try again." }, { status: 502 });
  const url = storage.getPublicUrl(path).data.publicUrl;
  await setLogo(who.userId, url);
  return Response.json({ logo_url: url });
}
