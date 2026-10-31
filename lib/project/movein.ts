// Moving in, as it goes in real life: the build finishes, everyone walks through it and lists what still needs fixing
// (snags), the builder fixes them and hands over the pack (warranty, notes, drawings), the client accepts and moves
// in, and then says how each pro did. Pure rules, shared by the browser and the server.

export type SnagStatus = "open" | "fixed" | "closed";
export type SnagAction = "fix" | "close" | "reopen";
/** `runs`: whoever runs the site fixes snags; `decides`: whoever accepts the handover confirms or reopens them. */
export type SnagSide = { runs: boolean; decides: boolean };

/** The next status after an action, or null when this person can't take it from here. */
export function snagStep(status: SnagStatus, action: SnagAction, side: SnagSide): SnagStatus | null {
  if (action === "fix" && side.runs && status === "open") return "fixed";
  if (action === "close" && side.decides && status === "fixed") return "closed";
  // someone who both runs and decides (an owner building it themselves) can close straight from open
  if (action === "close" && side.decides && side.runs && status === "open") return "closed";
  if (action === "reopen" && side.decides && status === "fixed") return "open";
  return null;
}

export const snagActions = (status: SnagStatus, side: SnagSide): SnagAction[] => (["fix", "close", "reopen"] as const).filter((a) => snagStep(status, a, side));

/** The handover can be accepted once every phase is done and the project is still being built. */
export const canAccept = (p: { status: string; allDone: boolean }) => p.status === "building" && p.allDone;

/** When the warranty runs out: the handover day plus the months the builder gave. */
export function warrantyUntil(handedOver: string | null, months: number | null): string | null {
  if (!handedOver || !months) return null;
  const d = new Date(handedOver);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export type Check = { id: "built" | "snags" | "pack" | "fees" | "accept"; label: string; done: boolean; note?: string };

/** The steps to moving in, each done or not, said plainly. */
export function moveInChecks(s: { allDone: boolean; snags: { status: SnagStatus }[]; warrantyMonths: number | null; feesOpen: number; handedOver: boolean; selfBuild?: boolean }): Check[] {
  const open = s.snags.filter((x) => x.status !== "closed").length;
  const steps: Check[] = [
    { id: "built", label: "Every phase finished", done: s.allDone },
    { id: "snags", label: "Walk through it and list anything to fix", done: (s.allDone && s.snags.length > 0 && open === 0) || s.handedOver, note: s.snags.length ? `${open} of ${s.snags.length} still open` : "Nothing listed yet" },
    { id: "pack", label: "Handover pack: warranty, notes and drawings", done: s.warrantyMonths !== null, note: s.warrantyMonths !== null ? `${s.warrantyMonths}-month warranty` : undefined },
    { id: "fees", label: "Fees settled", done: s.feesOpen === 0, note: s.feesOpen ? `${s.feesOpen} not received yet` : undefined },
    { id: "accept", label: "Accept the handover and move in", done: s.handedOver },
  ];
  // building it yourself, there's no one to hand a pack to
  return s.selfBuild ? steps.filter((c) => c.id !== "pack") : steps;
}

/** A rating is a whole number of stars, one to five. */
export const validRating = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5;

/** "★ 4.7 · 3 reviews", or null with none. */
export function ratingLine(ratings: number[]): string | null {
  if (!ratings.length) return null;
  const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  return `★ ${avg.toFixed(1)} · ${ratings.length} review${ratings.length === 1 ? "" : "s"}`;
}
