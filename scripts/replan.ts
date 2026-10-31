// Rebuilds a project's plan options from its saved room program with the current engine and ranking,
// and clears the chosen plan so the user picks again. --living '{...}' first saves "how they live" answers.
// Run: node --env-file=.env.local --env-file=.env scripts/replan.ts <projectId> [--living '{"kitchen":"open"}']
import { getProject, updateProject } from "../lib/project/store.ts";
import { optionsFor } from "../lib/design/program.ts";
import { Living, livingOf, mergeLiving } from "../lib/interview/living.ts";

const [id, flag, json] = process.argv.slice(2);
let p = await getProject(id);
if (flag === "--living") {
  const living = mergeLiving(livingOf(p.interview), Living.parse(JSON.parse(json)));
  p = await updateProject(id, { interview: { ...p.interview, living } });
}
if (!p.program) throw new Error("this project has no room program yet; run the design first");
const options = optionsFor(p.program, { width: p.site.width ?? 12, depth: p.site.depth ?? 10 }, p, 1);
if (!options) throw new Error("no layout concept fits this program on this site");
await updateProject(id, { options, chosen_option: null });
for (const o of options) console.log(`${o.concept?.name}\n  ${o.concept?.why.join("\n  ") || "(no personal reasons yet)"}`);
