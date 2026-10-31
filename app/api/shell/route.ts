import { userOf } from "@/lib/auth/request";
import { shellFor } from "@/lib/shell/data";
import { dayIn } from "@/lib/site/plan";

// The sidebar's data: the role's counts and every project this person is on. A guest gets nothing.
export async function GET(request: Request) {
  const cookie = request.headers.get("cookie");
  const userId = await userOf(cookie);
  if (!userId) return Response.json({ shell: null }, { status: 401 });
  const tz = cookie?.match(/(?:^|;\s*)amorphix_tz=([^;]+)/)?.[1];
  return Response.json({ shell: await shellFor(userId, dayIn(tz ? decodeURIComponent(tz) : undefined)) });
}
