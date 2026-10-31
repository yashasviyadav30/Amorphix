// Rebuilds a project's taste profile from what it loves, with the current taste rules (brand filters, weights).
// Run: node --env-file=.env.local --env-file=.env scripts/retaste.ts <projectId> [...]
import { getProject, updateProject } from "../lib/project/store.ts";
import { profileFor } from "../lib/qloo/profile.ts";

for (const id of process.argv.slice(2)) {
  const p = await getProject(id);
  const taste = await profileFor(p.taste_signals);
  const before = (p.taste?.brands ?? []).map((b) => b.name);
  await updateProject(id, { taste });
  const after = taste.brands.map((b) => b.name);
  console.log(id.slice(0, 8), "dropped:", before.filter((n) => !after.includes(n)).join(", ") || "none", "| added:", after.filter((n) => !before.includes(n)).join(", ") || "none");
}
