import type { LanguageModel } from "ai";
import type { Layout, SpaceType } from "../layout/schema.ts";
import { validate } from "../layout/validate.ts";
import { createProject, getProject, updateProject, type Project } from "../project/store.ts";
import { search } from "../qloo/api.ts";
import { profileFor } from "../qloo/profile.ts";
import { resolvePicks, type Pick } from "./taste.ts";
import { layerOf } from "../qloo/taste.ts";
import { planOptionsFor } from "../design/options.ts";
import { programOf, readPlan, type Hints } from "./read.ts";
import { blocking, snapPlan, type ReadPlan } from "./snap.ts";
import { applyEdits, importedOf, plainProblem, rescale, type Edit, type Imported } from "./edits.ts";

export { applyEdits, importedOf, rescale, type Edit, type Imported };

// Bring your own plan: upload, read, check, a few taste questions, then the usual design steps with the
// user's plan first and two other layouts of the same rooms beside it.


/**
 * Read the plan, check it, and if rooms overlap or leave holes, tell the model what's wrong and let it look
 * again: up to three readings, keeping the one with the fewest problems.
 */
export async function readChecked(data: Uint8Array, mediaType: string, hints: Hints, model: LanguageModel, tries = 3): Promise<Imported> {
  let best: Imported | null = null;
  let feedback: string | undefined;
  for (let i = 0; i < tries; i++) {
    const { read, questions } = await readPlan(data, mediaType, hints, model, feedback);
    const { layout, problems, advice } = snapPlan(read);
    const now: Imported = { read, layout, problems, advice, questions };
    if (!best || problems.length < best.problems.length) best = now;
    if (!problems.length) break;
    feedback = problems.map((p) => `- ${plainProblem(p, layout)}`).join("\n");
  }
  return best!;
}

/** Upload: a new project for this guest, holding what was read off their plan, waiting for them to check it. */
export async function importPlan(guestId: string, data: Uint8Array, mediaType: string, hints: Hints, model: LanguageModel, userId: string | null = null): Promise<Project> {
  const imported = await readChecked(data, mediaType, hints, model);
  return createProject({
    guest_id: guestId,
    owner_id: userId,
    space_type: hints.spaceType,
    title: "Your plan",
    status: "designing",
    site: { width: imported.read.width, depth: imported.read.depth, floors: imported.layout.floors.length, units: hints.units },
    interview: { imported },
  });
}

export type Confirm = { edits: Edit[]; answers?: Record<string, string>; size?: { width: number; depth: number }; picks: Pick[]; location?: string; title?: string };

/**
 * Check: apply the user's corrections (and size, if they gave one), build their taste from what they love,
 * and set the plans: theirs first, then two other layouts of the same rooms picked for their taste.
 * Fails with a plain message if the plan still has problems that stop it being modelled.
 */
export async function confirmImport(id: string, c: Confirm): Promise<Project> {
  const p = await getProject(id);
  const imp = importedOf(p.interview);
  if (!imp) throw new Error("This project wasn't started from an uploaded plan.");
  const units = p.site.units ?? "metric";
  const toM = (v: number) => (units === "imperial" ? v * 0.3048 : v);
  let layout = imp.layout;
  let read = imp.read;
  if (c.size && c.size.width > 0 && c.size.depth > 0) {
    read = rescale(read, toM(c.size.width), toM(c.size.depth));
    layout = snapPlan(read).layout;
  }
  layout = applyEdits(layout, c.edits);
  const problems = blocking(validate(layout));
  if (problems.length) throw new Error(`The plan still needs fixing: ${problems.slice(0, 3).join("; ")}`);

  // Their taste, from the three things they picked: the place and brand feed style tags, the film or music
  // reaches home brands. Checked before any plan work, so a bad pick fails fast.
  const found = await resolvePicks(c.picks, search);
  const signals = found.map((e) => ({ entityId: e.entity_id, name: e.name, layer: layerOf(e), type: e.types?.[0] }));
  const taste = await profileFor(signals, new Map(found.map((e) => [e.entity_id, e])));

  const own: Layout = { ...layout, concept: { id: "own", name: "Your plan", summary: "The plan you uploaded, as drawn.", why: ["This is your own plan, read from the drawing you uploaded."] } };
  const program = programOf(layout);
  const who = { interview: p.interview, taste, space_type: p.space_type };
  const others = planOptionsFor(program, layout.shell, who).slice(0, 2);
  return updateProject(id, {
    title: c.title?.trim() || p.title,
    site: { ...p.site, width: layout.shell.width, depth: layout.shell.depth, floors: layout.floors.length, location: c.location?.trim() || p.site.location },
    interview: { ...p.interview, imported: { ...imp, read, layout, problems: [], confirmed: true }, importAnswers: c.answers ?? {} },
    taste_signals: signals,
    taste,
    program,
    options: [own, ...others],
    chosen_option: null,
  });
}
