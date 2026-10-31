// Compares models on the real design pipeline (the style brief and the room list), on real test projects.
// For each model and project: did the brief pass the schema, how many credits keepHonest had to drop (claims to loves
// the person never named), did the room list lay out into plans, how many plans, and how long each call took.
// Read-only: nothing is saved. Run:
//   node --env-file=.env.local --env-file=.env scripts/compare-models.ts [model ...]
import { createClient } from "@supabase/supabase-js";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { Brief, allowedSources, briefPrompt, keepHonest } from "../lib/design/brief.ts";
import { generateProgram } from "../lib/design/program.ts";
import type { Project } from "../lib/project/store.ts";

const PROJECTS = ["ab285435-ac14-4fab-9a02-2659470050f0", "6c3c535f-0c33-45d6-be65-f0b6d8899b78", "90412e56-604e-428b-beb7-740aecb77009"];
const models = process.argv.slice(2).length ? process.argv.slice(2) : ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"];
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const credits = (b: Brief) => b.palette.reduce((n, c) => n + c.from.length, 0) + b.materials.reduce((n, m) => n + m.from.length, 0) + b.lighting.from.length;
const rows: string[] = [];
for (const id of PROJECTS) {
  const { data } = await db.from("projects").select("*").eq("id", id).single();
  const p = data as Project;
  for (const name of models) {
    const model = google(name);
    let brief = "fail";
    let dropped = "-";
    let bms = 0;
    const t0 = Date.now();
    try {
      const { output } = await generateText({ model, output: Output.object({ schema: Brief }), prompt: briefPrompt(p) });
      bms = Date.now() - t0;
      const honest = keepHonest(output, allowedSources(p));
      brief = output.name;
      dropped = `${credits(output) - credits(honest)}/${credits(output)}`;
    } catch (e) {
      bms = Date.now() - t0;
      brief = `fail: ${String(e instanceof Error ? e.message : e).slice(0, 60)}`;
    }
    const t1 = Date.now();
    let plans = "fail";
    try {
      const r = await generateProgram(p, model);
      plans = `${r.options.length} plans from the ${r.source}, ${r.program.rooms.length} rooms`;
    } catch (e) {
      plans = `fail: ${String(e instanceof Error ? e.message : e).slice(0, 60)}`;
    }
    const pms = Date.now() - t1;
    rows.push(`| ${p.title} | ${name} | ${brief} | ${dropped} | ${(bms / 1000).toFixed(1)} s | ${plans} | ${(pms / 1000).toFixed(1)} s |`);
    console.log(rows.at(-1));
  }
}
console.log("\n| Project | Model | Style name | Credits dropped | Brief time | Room list | Room list time |\n|---|---|---|---|---|---|---|\n" + rows.join("\n"));
