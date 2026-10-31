import type { Layout } from "../layout/schema.ts";
import type { Tier } from "./costs.ts";

// How long the job takes, phase by phase, from design to handover. Durations are typical for the size of the job
// and grow with floor area, scope (a new building, or fitting out an existing one) and quality (premium pieces have
// longer lead times). Some phases overlap, as they do on site: furniture is ordered while finishes go on.

export type Phase = { id: string; name: string; start: number; weeks: number; note: string };
export type Timeline = { phases: Phase[]; weeks: number };

const LEAD: Record<Tier, number> = { essential: 0.85, mid: 1, premium: 1.2, luxury: 1.5 };

/** Weeks from the size of the job: a base plus a little per 10 m², never under the base. */
const size = (base: number, per10: number, area: number) => Math.max(base, Math.round(base + (per10 * area) / 10 - per10 * 10));

export function timeline(layout: Layout, tier: Tier, newBuild = false): Timeline {
  const area = layout.floors.reduce((a, f) => a + f.spaces.reduce((b, s) => b + s.rect.w * s.rect.h, 0), 0);
  const home = ["house", "apartment", "studio"].includes(layout.spaceType);
  const has = (kind: string) => layout.floors.some((f) => f.spaces.some((s) => s.kind === kind));
  const lead = LEAD[tier];
  const out: Phase[] = [];
  let t = 0;
  const add = (id: string, name: string, weeks: number, note: string, overlap = 0) => {
    const start = Math.max(0, t - overlap);
    out.push({ id, name, start, weeks, note });
    t = Math.max(t, start + weeks);
  };
  add("design", "Design and drawings", size(3, 0.2, area), "Final plan, materials and drawings signed off.");
  if (newBuild) {
    add("permits", "Permits and approvals", 8, "Building permission; it varies most by city.");
    add("structure", "Foundations and structure", size(12, 0.6, area), "Ground works, frame, roof and walls.");
  } else {
    add("prep", home ? "Strip-out and prep" : "Strip-out and site set-up", size(1, 0.05, area), "Clearing the space and protecting what stays.");
  }
  add("services", "Electrical and plumbing", size(2, 0.15, area), "Wiring, lighting points, pipes and drains, before walls close.");
  if (has("kitchen") || has("bath") || has("counter"))
    add("joinery", has("counter") && !home ? "Counter, kitchen and fixtures" : "Kitchen, bathrooms and joinery", Math.round(size(3, 0.1, area) * lead), "Made to measure, so it is ordered at the start of this phase.");
  add("finishes", "Floors, walls and ceilings", size(2, 0.2, area), "Flooring, plaster, tiling and paint.", 1);
  add("furniture", "Furniture and fittings", Math.round(size(2, 0.05, area) * lead), "Ordered during finishes; arrives and is installed now.", 1);
  add("plants", "Plants and styling", 1, "Plants placed for the light in each room, art hung, final touches.");
  add("handover", "Snagging and handover", 1, "Walk-round, fixes, keys.");
  return { phases: out, weeks: t };
}
