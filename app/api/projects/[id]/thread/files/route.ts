import { accessTo, userOf } from "@/lib/auth/request";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MAX_BYTES = 10 * 1024 * 1024;
// Photos, PDFs and common office and drawing files. Shown only through signed links, never served from our origin.
const TYPES = /^(image\/(png|jpeg|webp|gif|heic)|application\/(pdf|zip|vnd\.openxmlformats-officedocument\.[\w.]+|msword|vnd\.ms-excel|dxf)|text\/plain|image\/vnd\.dxf)$/;

// Upload a file for a thread message. The message itself is posted separately with the returned path.
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/thread/files">) {
  const a = await accessTo((await ctx.params).id, request.headers.get("cookie"), "message");
  if (!a) return Response.json({ error: "not found" }, { status: 404 });
  if (!(await userOf(request.headers.get("cookie")))) return Response.json({ error: "Sign in to share files." }, { status: 401 });
  const file = (await request.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "That file is over 10 MB." }, { status: 413 });
  const type = file.type || "application/octet-stream";
  if (!TYPES.test(type)) return Response.json({ error: "Share photos, PDFs, office documents or drawings." }, { status: 415 });
  const safe = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120) || "file";
  const path = `${a.project.id}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabaseAdmin().storage.from("thread").upload(path, file, { contentType: type });
  if (error) return Response.json({ error: "Upload failed. Please try again." }, { status: 502 });
  return Response.json({ path, name: file.name.slice(0, 200), type, size: file.size }, { status: 201 });
}
