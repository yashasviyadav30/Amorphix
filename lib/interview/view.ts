// Pure helpers that turn the interviewer's message stream into what the screen shows.
// They only read the shapes they need, so they work with eve's message type and with test data.

type Part = { type: string; text?: string; toolName?: string; state?: string; input?: unknown; output?: unknown; toolMetadata?: { eve?: { label?: string } } };
export type Msg = { id: string; role: "assistant" | "user"; parts: readonly Part[] };

export type TasteView = { style: { word: string; from: string[] }[]; brands: { name: string; look: string[] }[]; count: number; family?: string; words?: { word: string; from: string | null }[] };

const done = (p: Part) => p.type === "dynamic-tool" && p.state === "output-available";

// The newest taste profile the interviewer built, or null before the first one.
export function latestTaste(messages: readonly Msg[]): TasteView | null {
  for (let m = messages.length - 1; m >= 0; m--) {
    const parts = messages[m].parts;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (done(p) && p.toolName === "add_taste" && p.output && typeof p.output === "object") {
        const o = p.output as { style?: TasteView["style"]; brands?: TasteView["brands"]; tasteCount?: number };
        return { style: o.style ?? [], brands: o.brands ?? [], count: o.tasteCount ?? 0 };
      }
    }
  }
  return null;
}

// The project id once the interview has finished successfully.
export function finishedProject(messages: readonly Msg[]): string | null {
  for (const m of messages)
    for (const p of m.parts)
      if (done(p) && p.toolName === "finish_interview") {
        const o = p.output as { ready?: boolean; projectId?: string };
        if (o?.ready && o.projectId) return o.projectId;
      }
  return null;
}

// The plain text of a message, for showing and for speaking aloud.
export const textOf = (m: Msg) =>
  m.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!.trim())
    .join("\n\n");

// Text fit for a voice: no markdown symbols, links read as their words.
export function speakable(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*(?:[-•]|\d+\.)\s+/gm, "")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}

// The tool activity to show while the agent works, newest last.
// What each tool is doing, in words, for when the agent's own label doesn't come through: the user should never
// see a tool's code name.
const DOING: Record<string, string> = {
  set_project: "Saving the project details",
  save_answers: "Noting what you said",
  save_living: "Noting how you live",
  save_running: "Noting how you run it",
  find_taste: "Looking up what you love",
  add_taste: "Updating your taste profile",
  finish_interview: "Getting your design ready",
};

export function activity(m: Msg) {
  return m.parts
    // Suggested answers show as chips, not as a line of activity.
    .filter((p) => p.type === "dynamic-tool" && p.toolName !== "offer_choices")
    .map((p) => ({
      label: p.toolMetadata?.eve?.label ?? DOING[p.toolName ?? ""] ?? "Working",
      working: !done(p) && p.state !== "output-error",
    }));
}

/** The interview's stages, in order, for the progress rail. */
export const STAGES = ["Project", "People", "How it's used", "Taste", "Design"] as const;

/**
 * How far the interview has got, 0 to 5: a stage counts once the tool that records it has run (the project saved,
 * people noted, how they live or run it noted, three things they love added, the interview finished).
 */
export function stageReached(messages: readonly Msg[]): number {
  const ran = new Set<string>();
  let tastes = 0;
  for (const m of messages)
    for (const p of m.parts)
      if (done(p) && p.toolName) {
        ran.add(p.toolName);
        if (p.toolName === "add_taste") tastes = Math.max(tastes, (p.output as { tasteCount?: number } | undefined)?.tasteCount ?? 0);
      }
  const steps = [
    ran.has("set_project"),
    ran.has("save_answers"),
    ran.has("save_living") || ran.has("save_running"),
    tastes >= 3,
    finishedProject(messages) !== null,
  ];
  // Stages fill in order: the rail never shows a later stage done before an earlier one.
  const first = steps.indexOf(false);
  return first === -1 ? steps.length : first;
}

export type Choices = { choices: string[]; multi: boolean; hint: string | null };

/** The answers to tap for the question just asked: from the latest message, only if it is Amorphix's. */
export function pendingChoices(messages: readonly Msg[]): Choices | null {
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") return null;
  for (let i = last.parts.length - 1; i >= 0; i--) {
    const p = last.parts[i];
    if (p.type !== "dynamic-tool" || p.toolName !== "offer_choices" || !p.input || typeof p.input !== "object") continue;
    const inp = p.input as { choices?: unknown; multi?: unknown; hint?: unknown };
    const choices = Array.isArray(inp.choices) ? inp.choices.filter((c): c is string => typeof c === "string" && c.trim() !== "").slice(0, 8) : [];
    const hint = typeof inp.hint === "string" && inp.hint.trim() ? inp.hint.trim() : null;
    if (!choices.length && !hint) return null;
    return { choices, multi: inp.multi === true, hint };
  }
  return null;
}

/** Several picks as one answer: "Me, My partner and A dog". */
export const joinPicks = (picks: string[]) => (picks.length < 2 ? (picks[0] ?? "") : `${picks.slice(0, -1).join(", ")} and ${picks.at(-1)}`);
