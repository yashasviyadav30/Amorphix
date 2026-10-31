// Reads a floor plan image or PDF with the real model and prints what Amorphix made of it.
// Run: node --env-file=.env.local --env-file=.env scripts/read-plan.ts plan.png [spaceType] [width depth units]
import { readFileSync } from "node:fs";
import { readPlan } from "../lib/plan-import/read.ts";
import { snapPlan } from "../lib/plan-import/snap.ts";
import { chatModel } from "../lib/models.ts";
import type { SpaceType } from "../lib/layout/schema.ts";

const [file, spaceType = "apartment", width, depth, units = "metric"] = process.argv.slice(2);
const mediaType = file.endsWith(".pdf") ? "application/pdf" : file.endsWith(".jpg") || file.endsWith(".jpeg") ? "image/jpeg" : file.endsWith(".webp") ? "image/webp" : "image/png";
const t0 = Date.now();
const { read, questions } = await readPlan(new Uint8Array(readFileSync(file)), mediaType, {
  spaceType: spaceType as SpaceType,
  width: width ? Number(width) : undefined,
  depth: depth ? Number(depth) : undefined,
  units: units as "metric" | "imperial",
}, chatModel());
console.log(`read in ${Date.now() - t0} ms: ${read.width.toFixed(1)} x ${read.depth.toFixed(1)} m`);
for (const r of read.rooms) console.log(`  ${r.name.padEnd(18)} ${r.kind.padEnd(10)} floor ${r.floor}  ${r.x.toFixed(1)},${r.y.toFixed(1)}  ${r.w.toFixed(1)} x ${r.h.toFixed(1)}`);
console.log("entry:", JSON.stringify(read.entry), "questions:", questions);
const { problems, advice } = snapPlan(read);
console.log("problems:", problems);
console.log("advice:", advice);
