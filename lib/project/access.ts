// Who may do what on a project. Every project route asks `can` before it acts, so this table is the one place
// permissions are decided. Safe to import from the browser (no server code).

export const MEMBER_ROLES = ["architect", "client", "builder", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export type ProjectRole = "owner" | MemberRole;

export type Action =
  | "view" // see the design, budget, shopping list, export
  | "comment"
  | "edit" // change the design: choose a plan, make changes, re-run, tick greenery
  | "invite" // add people and see the team
  | "approve"
  | "site" // run the building site
  | "message" // post in the project thread
  | "review"; // send the design for the client's review

const RULES: Record<ProjectRole, readonly Action[]> = {
  owner: ["view", "comment", "edit", "invite", "approve", "site", "message", "review"],
  architect: ["view", "comment", "edit", "invite", "message", "review"],
  client: ["view", "comment", "approve", "message"],
  builder: ["view", "comment", "site", "message"],
  viewer: ["view"],
};

export const can = (role: ProjectRole | null | undefined, action: Action) => !!role && RULES[role].includes(action);

/**
 * Which roles a person may invite. One client per project, and only on a pro's project: in an owner's own project
 * the owner is the client (Vicky, 16 Oct: more people on a project only confuses it).
 */
/** `ownerKind`: on a pro's own project, what the owner is; they don't invite a second one of themselves. */
export function invitable(role: ProjectRole | null | undefined, mode: "owner" | "pro" = "owner", hasClient = false, ownerKind: string | null = null): MemberRole[] {
  const base: MemberRole[] = (role === "owner" ? (["architect", "builder", "viewer"] as MemberRole[]) : role === "architect" ? (["builder", "viewer"] as MemberRole[]) : []).filter((r) => !(mode === "pro" && r === ownerKind));
  return base.length && mode === "pro" && !hasClient ? ["client", ...base] : base;
}

export const ROLE_NAME: Record<ProjectRole, string> = {
  owner: "Owner",
  architect: "Architect",
  client: "Client",
  builder: "Builder",
  viewer: "Viewer",
};

export const ROLE_CAN: Record<MemberRole, string> = {
  architect: "Designs and changes the plan, invites the client and builder",
  client: "Sees the design, comments and approves it",
  builder: "Sees the approved design and runs the site",
  viewer: "Can look, nothing else",
};

/** The pros on a project: only they see the team-only channel, and only when there are two or more of them. */
export const isPro = (role: ProjectRole | null | undefined) => role === "architect" || role === "builder";
