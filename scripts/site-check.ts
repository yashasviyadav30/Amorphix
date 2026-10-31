// Starts the building site on a project (if not started) and prints its state, to check the site logic against the
// real database without a browser. Run: node --env-file=.env.local --env-file=.env scripts/site-check.ts <project id>
import { getProject } from "../lib/project/store.ts";
import { siteOf, startSite } from "../lib/site/store.ts";

const id = process.argv[2];
let p = await getProject(id);
if (!(await siteOf(p))) {
  const s = await startSite(p, new Date());
  console.log("started; first phase:", s.first);
  p = await getProject(id);
}
const s = (await siteOf(p))!;
console.log("status:", p.status);
console.log("phases:", s.phases.map((x) => `${x.name} ${x.start_date}→${x.end_date} ${x.status} ${x.pct}%`).join(" | "));
console.log("materials:", s.materials.map((m) => `${m.name} ${m.needed} ${m.unit} @${m.unit_cost}`).join(" | "));
console.log("overall:", s.overall, "% · now:", s.current?.name, "· money:", JSON.stringify(s.money));
console.log("alerts:", s.alerts.map((a) => a.text));
