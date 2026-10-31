// Reads a project's uploaded plan again with the current reader and snapping, and resets its check step.
// Run: node --env-file=.env.local --env-file=.env scripts/reimport.ts <projectId> <plan file>
import { readFileSync } from "node:fs";
import { getProject, updateProject } from "../lib/project/store.ts";
import { readChecked } from "../lib/plan-import/flow.ts";
import { chatModel } from "../lib/models.ts";
import type { SpaceType } from "../lib/layout/schema.ts";

const [id, file] = process.argv.slice(2);
const p = await getProject(id);
const ext = file.split(".").pop()!.toLowerCase();
const mediaType = ext === "pdf" ? "application/pdf" : ext === "webp" ? "image/webp" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
const units = p.site.units ?? "imperial";
const { read, layout, problems, advice, questions } = await readChecked(new Uint8Array(readFileSync(file)), mediaType, { spaceType: (p.space_type ?? "house") as SpaceType, units }, chatModel());
await updateProject(id, {
  site: { ...p.site, width: read.width, depth: read.depth, floors: layout.floors.length },
  interview: { ...p.interview, imported: { read, layout, problems, advice, questions } },
  options: null,
  program: null,
  brief: null,
  chosen_option: null,
});
console.log({ rooms: read.rooms.length, entry: read.entry, problems, advice: advice.length, questions });
