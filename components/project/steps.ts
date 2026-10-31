// The steps after the questions: one screen per step, Next only. Changes happen in the workspace near the end, and
// the last step takes the design away: sketches, plans, the PDF pack, a DXF and the walkthrough video.
export const STEPS = [
  { id: "brief", label: "Your style" },
  { id: "plans", label: "Plans" },
  { id: "walkthrough", label: "Walkthrough" },
  { id: "budget", label: "Budget" },
  { id: "shop", label: "Shopping list" },
  { id: "workspace", label: "Make changes" },
  { id: "drawings", label: "Share & export" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

// Whether the user may move past a step yet. Plans need a choice; every other step is ready once shown.
export function canLeave(step: StepId, project: { chosen_option: number | null }): boolean {
  return step === "plans" ? project.chosen_option !== null : true;
}

export const nextStep = (step: StepId): StepId | null => {
  const i = STEPS.findIndex((s) => s.id === step);
  return i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1].id : null;
};

export const isStep = (v: string | null): v is StepId => STEPS.some((s) => s.id === v);
