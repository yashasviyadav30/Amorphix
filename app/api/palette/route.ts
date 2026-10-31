import { userOf } from "@/lib/auth/request";
import { projectsOf } from "@/lib/account/profile";
import { memberProjects } from "@/lib/project/team";
import { projectName } from "@/lib/home/names";

// The command box's list of projects: everything this person is on, newest first, named as on their cards.
export async function GET(request: Request) {
  const userId = await userOf(request.headers.get("cookie"));
  if (!userId) return Response.json({ projects: [] });
  const [own, shared] = await Promise.all([projectsOf(userId), memberProjects(userId)]);
  const all = [...own.map((p) => ({ ...p, role: "owner" })), ...shared].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return Response.json({ projects: all.slice(0, 60).map((p) => ({ id: p.id, name: projectName(p), role: p.role, status: p.status })) });
}
