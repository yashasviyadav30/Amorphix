import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { VOICE_RULES } from "../voice.ts";
import type { Project } from "../project/store.ts";
import { styleOf } from "../three/materials.ts";
import { STYLE_NAME } from "../quiz/picks.ts";

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// What the design is, in words a client reads. Every choice names the loved things it came from.
export const Brief = z.object({
  name: z.string().describe("a short style name, two or three words, e.g. 'Warm Modernist'"),
  summary: z.string().describe("two sentences on the overall feel, naming what it comes from"),
  palette: z
    .array(z.object({ name: z.string(), hex: Hex, role: z.enum(["base", "accent", "wood", "metal", "green", "textile"]), from: z.array(z.string()) }))
    .min(4)
    .max(6),
  materials: z.array(z.object({ name: z.string(), where: z.string(), from: z.array(z.string()) })).min(3).max(6),
  lighting: z.object({ mood: z.string(), fixtures: z.array(z.string()).min(1).max(4), from: z.array(z.string()) }),
  plants: z.array(z.object({ name: z.string(), where: z.string(), why: z.string() })).min(2).max(6),
});
export type Brief = z.infer<typeof Brief>;

// The names a brief may credit: only things the user actually said they love, or brands Qloo matched to them.
export function allowedSources(p: Project): string[] {
  const names = new Set(p.taste_signals.map((s) => s.name));
  for (const b of p.taste?.brands ?? []) names.add(b.name);
  return [...names];
}

// Drop any credit the model invented, so "from" never claims a source the user didn't give.
export function keepHonest(brief: Brief, allowed: string[]): Brief {
  const ok = new Set(allowed.map((n) => n.toLowerCase()));
  const clean = (from: string[]) => from.filter((f) => ok.has(f.toLowerCase()));
  return {
    ...brief,
    palette: brief.palette.map((c) => ({ ...c, hex: c.hex.toLowerCase(), from: clean(c.from) })),
    materials: brief.materials.map((m) => ({ ...m, from: clean(m.from) })),
    lighting: { ...brief.lighting, from: clean(brief.lighting.from) },
  };
}

/** The style the client was shown at the reveal ("Modern"), from the same taste. */
export const revealedStyle = (p: Pick<Project, "taste">): string => STYLE_NAME[styleOf(p.taste, "").style];

/** The style name keeps the revealed style's word, so the reveal and the export never disagree: "Eclectic Industrial"
 *  for someone shown "Modern" becomes "Eclectic Modern". */
export function keepStyle(name: string, family: string): string {
  if (name.toLowerCase().includes(family.toLowerCase())) return name;
  const first = name.trim().split(/\s+/)[0];
  return first && first.toLowerCase() !== family.toLowerCase() ? `${first} ${family}` : family;
}

export function briefPrompt(p: Project): string {
  const style = (p.taste?.tags ?? [])
    .slice(0, 15)
    .map((t) => `- ${t.family} "${t.value.replaceAll("_", " ")}" (weight ${t.weight.toFixed(1)}), from: ${t.sources.map((s) => s.name).join(", ")}`)
    .join("\n");
  const brands = (p.taste?.brands ?? [])
    .slice(0, 8)
    .map((b) => `- ${b.name}: ${b.aesthetic.slice(0, 4).join(", ").replaceAll("_", " ")}`)
    .join("\n");
  return `Write the design brief for this project.

Project: a ${p.space_type ?? "space"} in ${p.site.location ?? "an unknown city"}, ${p.site.floors ?? 1} floor(s).
What the client told us: ${JSON.stringify(p.interview)}
Things they love: ${p.taste_signals.map((s) => s.name).join(", ") || "none yet"}

Their style signals, strongest first:
${style || "- none"}

Home brands matched to their taste:
${brands || "- none"}

Rules:
- The client was shown their style as "${revealedStyle(p)}". The style name keeps that word and adds one of the strongest decor, ambience or aesthetic signals above in plain words (for "Industrial" and "eclectic": "Eclectic Industrial"), so it matches what they saw and they can see where it came from.
- Build every choice from the signals above. In each "from", list only names that appear in "Things they love" or the brand list, copied exactly.
- Be concrete: "smoked oak floors", "brass wall lights", not "natural materials".
- Every room gets living plants; pick plants that suit the city's climate and the style.
- Palette hex colours must be real, harmonious and usable on walls, floors and fabrics.

${VOICE_RULES}`;
}

export async function generateBrief(p: Project, model: LanguageModel): Promise<Brief> {
  const { output } = await generateText({ model, output: Output.object({ schema: Brief }), prompt: briefPrompt(p) });
  return { ...keepHonest(output, allowedSources(p)), name: keepStyle(output.name, revealedStyle(p)) };
}
