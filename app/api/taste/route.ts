import { guestOf } from "@/lib/auth/request";
import { isHomeBrand, search } from "@/lib/qloo/api";
import { matchesFor, slotOf, vagueHint } from "@/lib/plan-import/taste";

// Looks up one answer to a taste question, so the user sees what it matched before anything is designed.
export async function GET(request: Request) {
  if (!(await guestOf(request.headers.get("cookie")))) return Response.json({ error: "Please reload the page and try again." }, { status: 401 });
  const url = new URL(request.url);
  const slot = slotOf(url.searchParams.get("slot") ?? "");
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!slot || q.length < 2) return Response.json({ error: "Say a name." }, { status: 400 });
  // the project's city: a place by that name there comes first ("Hotel Bel-Air" means the one in Los Angeles)
  const near = (url.searchParams.get("near") ?? "").trim().slice(0, 80);
  try {
    const types = slot.types.join(",");
    const [plain, local] = await Promise.all([search(q, 10, types), slot.id === "place" && near && !q.toLowerCase().includes(near.split(",")[0].toLowerCase()) ? search(`${q} ${near.split(",")[0]}`, 10, types) : []]);
    // a brand here is one to furnish from: a magazine or a clothing label isn't offered
    const found = [...local, ...plain.filter((e) => !local.some((l) => l.entity_id === e.entity_id))].filter((e) => slot.id !== "brand" || isHomeBrand(e));
    const matches = matchesFor(slot.id, q, found, near);
    return Response.json({ matches, hint: matches.length ? null : vagueHint(slot.id) });
  } catch {
    return Response.json({ error: "Couldn't look that up just now. Try again in a moment." }, { status: 502 });
  }
}
