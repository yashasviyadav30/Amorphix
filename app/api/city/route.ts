import { guestOf, userOf } from "@/lib/auth/request";
import { cityLabel, type Place } from "@/lib/interview/city";

// What a typed city is on the map, with its country, so "Delih" can't quietly become a village in Slovenia.
// OpenStreetMap's geocoder, a few towns and cities at most; only for someone with a session (guest or signed in).
export async function GET(request: Request) {
  const cookie = request.headers.get("cookie");
  if (!(await guestOf(cookie)) && !(await userOf(cookie))) return Response.json({ places: [] }, { status: 401 });
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ places: [] });
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=en&featureType=settlement&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Amorphix/0.1 (amorphix.vercel.app)" }, signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } }).catch(() => null);
  if (!res?.ok) return Response.json({ places: [] });
  const hits = (await res.json()) as Place[];
  const labels = [...new Set(hits.map(cityLabel).filter((l): l is string => !!l))].slice(0, 3);
  return Response.json({ places: labels });
}
