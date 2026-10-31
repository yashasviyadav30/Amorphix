// Uploads the film (and its poster) to the public "media" bucket, where the landing page plays it from.
// The film shows Amorphix images, so it lives in storage, never in the repo.
// Run: node --env-file=.env.local --env-file=.env scripts/upload-video.ts <film.mp4> <poster.jpg>
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [film, poster] = process.argv.slice(2);
if (!film || !poster) throw new Error("usage: upload-video.ts <film.mp4> <poster.jpg>");
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { data: buckets } = await db.storage.listBuckets();
if (!buckets?.some((b) => b.name === "media")) {
  const { error } = await db.storage.createBucket("media", { public: true, fileSizeLimit: "50MB", allowedMimeTypes: ["video/mp4", "image/jpeg"] });
  if (error) throw error;
}
for (const [file, name, type] of [[film, "amorphix-film.mp4", "video/mp4"], [poster, "amorphix-film.jpg", "image/jpeg"]] as const) {
  const { error } = await db.storage.from("media").upload(name, readFileSync(file), { contentType: type, upsert: true, cacheControl: "3600" });
  if (error) throw error;
  console.log("uploaded", db.storage.from("media").getPublicUrl(name).data.publicUrl);
}
