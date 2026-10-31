// Fee milestones between a pro and the person paying them. The pro bills, the payer says they've paid, the pro
// confirms they received it; every step is on record. Pure rules, shared by the browser and the server.

export type FeeStatus = "planned" | "billed" | "claimed" | "received";
export type FeeAction = "bill" | "paid" | "received";
export type FeeSide = "pro" | "payer" | null;

/** Who someone is for fees on this project: the pro who runs it, the person who pays, or neither. */
export function sideOf(role: string, mode: "owner" | "pro"): FeeSide {
  if (role === "architect" || role === "builder") return "pro";
  if (role === "owner") return mode === "pro" ? "pro" : "payer"; // a pro's own project: they bill its client
  if (role === "client") return "payer";
  return null;
}

/** The next status after an action, or null when that side can't take it from here. */
export function step(status: FeeStatus, action: FeeAction, side: FeeSide): FeeStatus | null {
  if (side === "pro" && action === "bill" && status === "planned") return "billed";
  if (side === "payer" && action === "paid" && status === "billed") return "claimed";
  // A pro can confirm a payment the client marked, or one that came in before the client said so.
  if (side === "pro" && action === "received" && (status === "claimed" || status === "billed")) return "received";
  return null;
}

/** The buttons a person sees on a milestone. */
export function actionsFor(status: FeeStatus, side: FeeSide): FeeAction[] {
  return (["bill", "paid", "received"] as const).filter((a) => step(status, a, side));
}

export type ProKind = "architect" | "builder";

/** How each kind of pro is usually paid: an architect by design stage, a builder by stage of the build. */
// `phase`: the site phase a fee falls due on ("start" when the site starts, "handover" on moving in).
export const SPLITS: Record<ProKind, { label: string; share: number; phase?: string }[]> = {
  architect: [
    { label: "Design", share: 0.3 },
    { label: "Approval of the final design", share: 0.4 },
    { label: "Handover", share: 0.3 },
  ],
  builder: [
    { label: "Deposit", share: 0.1, phase: "start" },
    { label: "Foundations and structure", share: 0.3, phase: "structure" },
    { label: "Electrical and plumbing", share: 0.2, phase: "services" },
    { label: "Finishes", share: 0.3, phase: "finishes" },
    { label: "Handover", share: 0.1, phase: "handover" },
  ],
};

/** The split said in words: "deposit (10%), foundations and structure (30%)...". */
export const splitWords = (kind: ProKind) => SPLITS[kind].map((p) => `${p.label.toLowerCase()} (${Math.round(p.share * 100)}%)`).join(", ");

/** A common split of a total fee for this kind of pro. Rounds so the parts add up to the total. */
export function standardSplit(total: number, kind: ProKind = "architect"): { label: string; amount: number; phase?: string }[] {
  const parts = SPLITS[kind];
  const out = parts.map((p) => ({ label: p.label, amount: Math.round(total * p.share), ...(p.phase ? { phase: p.phase } : {}) }));
  out[out.length - 1].amount += Math.round(total) - out.reduce((s, p) => s + p.amount, 0);
  return out;
}

/**
 * A builder's fee split by the site's own phases: a 10% deposit when the site starts, 80% across the phases in
 * proportion to how long each runs, and 10% on handover. Each part falls due as its phase finishes. Rounds so the
 * parts add up to the total.
 */
export function phaseSplit(total: number, phases: { key: string; name: string; days: number }[]): { label: string; amount: number; phase: string }[] {
  if (!phases.length) return standardSplit(total, "builder").map((p) => ({ ...p, phase: p.phase ?? "start" }));
  const days = phases.reduce((n, p) => n + Math.max(1, p.days), 0);
  const out = [
    { label: "Deposit", amount: Math.round(total * 0.1), phase: "start" },
    ...phases.map((p) => ({ label: p.name, amount: Math.round((total * 0.8 * Math.max(1, p.days)) / days), phase: p.key })),
    { label: "Handover", amount: 0, phase: "handover" },
  ];
  out[out.length - 1].amount = Math.round(total) - out.reduce((s, p) => s + p.amount, 0);
  return out;
}

/** In words, when a fee falls due: "when the site starts", "when Electrical and plumbing finishes", "on handover". */
export function dueWhen(phase: string | null | undefined, phases: { key: string; name: string }[]): string | null {
  if (!phase) return null;
  if (phase === "start") return "when the site starts";
  if (phase === "handover") return "on handover";
  const p = phases.find((x) => x.key === phase);
  return p ? `when ${p.name} finishes` : null;
}

export const STATUS_LABEL: Record<FeeStatus, string> = { planned: "Planned", billed: "Billed", claimed: "Paid, to confirm", received: "Received" };

export const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
};
