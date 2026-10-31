import type { LanguageModel } from "ai";
import { generateBrief } from "./brief.ts";
import { generateProgram } from "./program.ts";
import { getProject, saveVersion, updateProject, type Project } from "../project/store.ts";

// Brief, room program and three plan options for a finished interview. Safe to call twice:
// parts already made are kept, so a retry after a timeout only does what's missing.
export async function designProject(id: string, model: LanguageModel): Promise<Project> {
  let p = await getProject(id);
  if (p.status === "interview") throw new Error("The interview isn't finished yet.");
  if (!p.brief) p = await updateProject(id, { brief: await generateBrief(p, model) });
  if (!p.program || !p.options?.length) {
    const { program, options } = await generateProgram(p, model);
    p = await updateProject(id, { program, options });
  }
  return p;
}

// The user picks one of the three plans; it becomes the first saved version of the design.
export async function chooseOption(id: string, option: number): Promise<Project> {
  const p = await getProject(id);
  const layout = p.options?.[option];
  if (!layout) throw new Error(`There is no plan option ${option + 1}.`);
  await saveVersion(id, layout, `Chose plan option ${option + 1}`);
  return updateProject(id, { chosen_option: option, status: "ready" });
}
