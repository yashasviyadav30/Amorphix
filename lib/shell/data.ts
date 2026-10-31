import { getProfile, projectsOf } from "../account/profile.ts";
import { memberProjects } from "../project/team.ts";
import { requestsFor } from "../pros/directory.ts";
import { boardFor } from "../home/board.ts";
import { sitesRunBy } from "../manage/data.ts";
import { projectName } from "../home/names.ts";
import { OPEN_FOR_JUDGING, stageOf } from "../project/stage.ts";
import type { ProjectRole } from "../project/access.ts";
import type { Role } from "../account/roles.ts";

// What the sidebar needs on every signed-in page: the role, the counts on its tools, and every project this person
// is on with where it stands. Light on purpose: no drawings, no estimates.

export type ShellProject = {
  id: string;
  name: string;
  role: ProjectRole;
  status: string;
  mode: string;
  space_type: string | null;
  stage: number;
  chosen: boolean;
  toured: boolean;
  unlocked: boolean;
  unread: number;
  owner: string | null;
};
export type Shell = { me: string; role: Role; counts: { waits: number; requests: number; live: number; fees: number; unread: number; runs: number }; projects: ShellProject[] };

export async function shellFor(userId: string, day?: string): Promise<Shell | null> {
  const profile = await getProfile(userId);
  if (!profile) return null;
  const pro = profile.role === "architect" || profile.role === "builder";
  const [own, shared, requests] = await Promise.all([projectsOf(userId), memberProjects(userId), pro ? requestsFor(userId) : []]);
  const all = [...own.map((p) => ({ ...p, role: "owner" as ProjectRole, owner: null as string | null })), ...shared].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 60);
  const [board, runs] = await Promise.all([
    boardFor(
    userId,
    all.map((p) => ({ id: p.id, name: projectName(p), role: p.role, mode: p.mode, status: p.status, chosen_option: p.chosen_option, space_type: p.space_type, site: p.site })),
    day,
    new Date(),
    true,
    ),
    // owners only: whether they run a build themselves (builders always get the site tools)
    profile.role === "owner" ? sitesRunBy(all.map((p) => ({ id: p.id, name: projectName(p), role: p.role, mode: p.mode as "owner" | "pro" }))) : [],
  ]);
  return {
    me: userId,
    role: profile.role,
    counts: {
      waits: board.waits.length,
      requests: requests.length,
      live: board.sites.length,
      fees: board.waits.filter((w) => w.kind === "pay" || w.kind === "confirm").length,
      unread: Object.values(board.unread).reduce((n, u) => n + u, 0),
      runs: runs.length,
    },
    projects: all.map((p) => ({
      id: p.id,
      name: projectName(p),
      role: p.role,
      status: p.status,
      mode: p.mode,
      space_type: p.space_type,
      stage: stageOf(p as Parameters<typeof stageOf>[0]),
      chosen: p.chosen_option !== null,
      toured: !!p.toured_at,
      unlocked: OPEN_FOR_JUDGING || !!p.unlocked_at,
      unread: board.unread[p.id] ?? 0,
      owner: p.owner ?? null,
    })),
  };
}
