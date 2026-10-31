// The roles people pick at sign-up. Safe to import from the browser.

// An owner designs their own space, a home or a business; what kind of space it is lives on the project.
export const ROLES = ["owner", "architect", "builder"] as const;
export type Role = (typeof ROLES)[number];
export type Plan = "free" | "owner" | "pro" | "build";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  architect: "Architect or interior designer",
  builder: "Builder or contractor",
};

/** The short name of a role, shown next to a person's name ("Vicky · Architect"). */
export const ROLE_SHORT: Record<Role, string> = { owner: "Owner", architect: "Architect", builder: "Builder" };
