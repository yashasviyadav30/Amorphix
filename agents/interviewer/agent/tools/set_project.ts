import { defineTool } from "eve/tools";
import { z } from "zod";
import { SpaceType } from "../../../../lib/layout/schema.ts";
import { updateProject } from "../../../../lib/project/store.ts";
import { siteSizeProblem, toMetres } from "../../../../lib/interview/logic.ts";
import { sessionProject } from "../lib/session.ts";
import { sizeFrom } from "../../../../lib/interview/logic.ts";

export default defineTool({
  description:
    "Record what is being designed and the site: the kind of space, the plot or floor size, the number of floors and the location. Call it whenever the user gives any of these; omit what you don't know yet.",
  inputSchema: z.object({
    spaceType: SpaceType.optional().describe("house, apartment, office, cafe (also restaurants), hotel, shop (also showrooms) or studio"),
    width: z.number().positive().optional().describe("street-side width of the plot or floor: the first number in '40 by 60'"),
    depth: z.number().positive().optional().describe("front-to-back depth of the plot or floor: the second number in '40 by 60'. Always send it with width when the user gave both"),
    size: z.string().optional().describe("the size as the user said it, e.g. '40 by 30 feet' or '12x9 m'"),
    unit: z.enum(["ft", "m"]).default("ft").describe("unit the user gave the size in"),
    floors: z.number().int().min(1).max(2).optional(),
    location: z.string().optional().describe("city and state or country, or a ZIP code"),
    newBuild: z.boolean().optional().describe("true for a new build, false for a renovation"),
  }),
  label: { start: () => "Saving the project details" },
  async execute(raw, ctx) {
    // Models sometimes send the width and drop the depth; the user's own words fill the gap.
    const input = { ...raw, ...sizeFrom(raw.size, raw.width, raw.depth) };
    const problem = siteSizeProblem(input.width, input.depth, input.unit);
    if (problem) return { saved: false, problem };
    const p = await sessionProject(ctx);
    const site = { ...p.site };
    if (input.width) site.width = toMetres(input.width, input.unit);
    if (input.depth) site.depth = toMetres(input.depth, input.unit);
    if (input.floors) site.floors = input.floors;
    if (input.location) site.location = input.location;
    site.units = input.unit === "m" ? "metric" : "imperial";
    const interview = input.newBuild === undefined ? p.interview : { ...p.interview, project: { newBuild: input.newBuild } };
    await updateProject(p.id, { space_type: input.spaceType ?? p.space_type, site, interview });
    return { saved: true };
  },
});
