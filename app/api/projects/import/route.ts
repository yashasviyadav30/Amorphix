import { whoOf } from "@/lib/auth/request";
import { SpaceType } from "@/lib/layout/schema";
import { chatModel } from "@/lib/models";
import { importPlan } from "@/lib/plan-import/flow";

// Upload a floor plan: one model call reads it, so well inside the function limit.
export const maxDuration = 120;

const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const { guestId, userId } = await whoOf(request.headers.get("cookie"));
  if (!guestId) return Response.json({ error: "Please reload the page and try again." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a plan to upload." }, { status: 400 });
  if (!TYPES.has(file.type)) return Response.json({ error: "Upload a PNG, JPG, WebP image or a PDF." }, { status: 415 });
  if (file.size > MAX_BYTES) return Response.json({ error: "That file is over 8 MB. Try a smaller image or PDF." }, { status: 413 });
  const num = (k: string) => {
    const v = Number(form!.get(k));
    return Number.isFinite(v) && v > 0 && v < 2000 ? v : undefined;
  };
  const spaceType = SpaceType.safeParse(form!.get("spaceType")).data ?? "house";
  const units = form!.get("units") === "metric" ? "metric" : "imperial";
  try {
    const p = await importPlan(guestId, new Uint8Array(await file.arrayBuffer()), file.type, { spaceType, width: num("width"), depth: num("depth"), units }, chatModel(), userId);
    return Response.json({ id: p.id });
  } catch (e) {
    console.warn("plan import failed:", e instanceof Error ? e.message : e);
    return Response.json({ error: "We couldn't read that plan. Try a clearer image with the room names on it." }, { status: 422 });
  }
}
