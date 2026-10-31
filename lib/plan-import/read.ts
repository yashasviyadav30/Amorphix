import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import type { Layout, Program, SpaceType } from "../layout/schema.ts";
import type { ReadPlan, ReadRoom } from "./snap.ts";

// Reading someone's floor plan (a photo, a scan or a PDF) into rooms, with a model that can see images.
// The model returns a loose shape (Gemini rejects strict schemas); code checks, scales and cleans it.

export const KINDS = [
  "living", "kitchen", "dining", "bedroom", "bath", "office", "laundry", "storage", "closet", "corridor", "stairs",
  "workspace", "meeting", "reception", "lounge", "counter", "retail", "fitting", "guest-room", "pantry",
] as const;

const LooseRead = z.object({
  width: z.number().describe("the building's width across the drawing, in metres"),
  depth: z.number().describe("the building's depth from the front (street) to the back, in metres"),
  scaleFromDrawing: z.boolean().describe("true if the drawing shows dimensions or a scale bar you used"),
  rooms: z.array(
    z.object({
      name: z.string(),
      kind: z.string().describe(`one of: ${KINDS.join(", ")}`),
      floor: z.number().describe("0 for the ground floor, 1 for the floor above"),
      // Nullable: one room the model couldn't measure must not throw away the whole reading.
      x: z.number().nullable().describe("metres from the left edge of the building to the room's left wall"),
      y: z.number().nullable().describe("metres from the front edge (top of the drawing) to the room's front wall"),
      w: z.number().nullable().describe("room width in metres"),
      h: z.number().nullable().describe("room depth in metres"),
    }),
  ),
  entry: z
    .object({ x: z.number(), y: z.number() })
    .nullable()
    .describe("the front door's position on the outside wall, in the same metres as the rooms; null if no entrance is drawn"),
  questions: z.array(z.string()).describe("only real doubts to ask the user, one short question each; empty if none"),
});
export type LooseRead = z.infer<typeof LooseRead>;

export type Hints = { spaceType: SpaceType; width?: number; depth?: number; units: "imperial" | "metric" };

const FT = 0.3048;

/**
 * Cleans what the model read: drops impossible rooms, maps unknown kinds to the nearest known one, and scales
 * everything to the size the user gave (their numbers beat the model's reading of the drawing). If the user
 * gave no size and the drawing had no scale, it asks for one.
 */
// Drawings often label rooms in capitals; show them as "Living and dining", not "LIVING AND DINING".
const tidy = (name: string) => {
  const n = name.trim().replace(/\s+/g, " ") || "Room";
  return n === n.toUpperCase() && /[A-Z]/.test(n) ? n.charAt(0) + n.slice(1).toLowerCase() : n;
};

export function fromModel(raw: LooseRead, hints: Hints): { read: ReadPlan; questions: string[] } {
  const questions = raw.questions.map((q) => q.trim()).filter(Boolean).slice(0, 3);
  const toM = (v: number | undefined) => (v === undefined ? undefined : hints.units === "imperial" ? v * FT : v);
  const userW = toM(hints.width);
  const userD = toM(hints.depth);
  const fx = userW && raw.width > 0 ? userW / raw.width : 1;
  const fy = userD && raw.depth > 0 ? userD / raw.depth : userW && raw.width > 0 ? fx : 1;
  if (!userW && !userD && !raw.scaleFromDrawing)
    questions.unshift(hints.units === "imperial" ? "How wide and how deep is the building, in feet?" : "How wide and how deep is the building, in metres?");
  const kind = (k: string): string => {
    const t = k.toLowerCase().replace(/[^a-z -]/g, "").trim();
    if ((KINDS as readonly string[]).includes(t)) return t;
    if (/bed|master|nursery|kid/.test(t)) return "bedroom";
    if (/bath|wc|toilet|shower|powder|restroom/.test(t)) return "bath";
    if (/hall|corridor|passage|foyer|entry|landing/.test(t)) return "corridor";
    if (/stair/.test(t)) return "stairs";
    if (/kitchen|cook/.test(t)) return "kitchen";
    if (/dining|dinner/.test(t)) return "dining";
    if (/study|office|den/.test(t)) return "office";
    if (/utility|laundry|wash/.test(t)) return "laundry";
    if (/store|storage|closet|wardrobe/.test(t)) return "storage";
    return "living";
  };
  const rooms: ReadRoom[] = raw.rooms
    .filter((r): r is typeof r & { x: number; y: number; w: number; h: number } => [r.x, r.y, r.w, r.h].every((v) => typeof v === "number" && Number.isFinite(v)) && r.w! > 0.3 && r.h! > 0.3)
    .map((r) => ({ name: tidy(r.name), kind: kind(r.kind), floor: r.floor >= 1 ? 1 : 0, x: r.x * fx, y: r.y * fy, w: r.w * fx, h: r.h * fy }));
  const width = (raw.width || 10) * fx;
  const depth = (raw.depth || 10) * fy;
  let entry = raw.entry && Number.isFinite(raw.entry.x) && Number.isFinite(raw.entry.y) ? { x: raw.entry.x * fx, y: raw.entry.y * fy } : null;
  // Amorphix keeps the street side at y = 0. If the drawn entrance is on the far side, turn the plan around.
  if (entry && entry.y > depth * 0.75) {
    for (const r of rooms) r.y = depth - r.y - r.h;
    entry = { x: entry.x, y: depth - entry.y };
  }
  return { read: { spaceType: hints.spaceType, width, depth, rooms, entry }, questions };
}

export function readPrompt(hints: Hints): string {
  return `This is a floor plan of a ${hints.spaceType}. Read every room off it.

Use metres. Read the drawing as it is, without turning it: x runs left to right from the building's left
outside wall, y runs top to bottom from its top outside wall. Give each room as a rectangle (x, y, width w,
depth h). For an L-shaped room, give its biggest rectangle.
Include halls and landings as kind "corridor" and the stairs as kind "stairs", with floor 0 or 1.
Where a room's size is written inside it (for example 9'-0" x 12'-0"), use those numbers: they are the room's
width and depth as drawn. Rooms side by side in a row add up to the building's width.
Neighbouring rooms share their walls: where two rooms meet, one's edge equals the other's. Rooms along the
outside start exactly at 0 or end exactly at the building's width or depth. Together the rooms and halls should
fill the whole building with no gaps.
${hints.width ? `The user says the building is ${hints.width} by ${hints.depth ?? "?"} ${hints.units === "imperial" ? "feet" : "metres"}.` : "If the drawing shows dimensions or a scale bar, use them and set scaleFromDrawing to true."}
Room kinds: ${KINDS.join(", ")}.
Give the front door's position (entry) as a point on the outside wall where the main entrance is drawn: the
door into a hall, living or dining space, not a side door into a laundry, garage or utility room.
Ask a question only if you really can't tell something that matters (for example which floor a room is on,
or what an unlabelled room is for). Never invent rooms that aren't drawn.`;
}

/**
 * Reads a plan image or PDF with a vision model, then cleans the result. `feedback` describes what was wrong
 * with an earlier reading (rooms overlapping, gaps), so the model can look at the drawing again.
 */
export async function readPlan(data: Uint8Array, mediaType: string, hints: Hints, model: LanguageModel, feedback?: string) {
  const prompt = feedback ? `${readPrompt(hints)}

An earlier reading of this drawing had these problems:
${feedback}
Look at the drawing again and fix them.` : readPrompt(hints);
  const { output } = await generateText({
    model,
    output: Output.object({ schema: LooseRead }),
    messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "file", mediaType, data }] }],
  });
  return fromModel(LooseRead.parse(output), hints);
}

/** The room program behind someone's plan: the same rooms at the same sizes, so other layouts can be offered. */
export function programOf(layout: Layout): Program {
  return {
    spaceType: layout.spaceType,
    floors: layout.floors.length,
    rooms: layout.floors.flatMap((f) =>
      f.spaces
        .filter((s) => s.zone !== "circulation")
        .map((s) => ({ id: s.id, name: s.name, kind: s.kind, area: Math.max(2, Math.round(s.rect.w * s.rect.h)), zone: s.zone as "public" | "private" | "service", floor: f.level })),
    ),
  };
}
