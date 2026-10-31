import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import type { Layout } from "../layout/schema.ts";
import { ADDABLE, type Change } from "./edit.ts";

// For requests the plain rules can't read ("give the kids more room to play"): one model call maps the request to
// one of the same five changes, so whatever it picks still goes through the engine and the validator. A flat schema,
// because Gemini rejects unions in tool and output schemas; code turns it into a Change and checks it.

const Loose = z.object({
  op: z.enum(["resize", "add", "remove", "rename", "kitchen", "none"]),
  room: z.string().optional().describe("the id of the room it acts on, from the list"),
  bigger: z.boolean().optional().describe("resize: true for bigger, false for smaller"),
  kind: z.string().optional().describe("add: one of the kinds listed"),
  name: z.string().optional().describe("rename: the new name"),
  open: z.boolean().optional().describe("kitchen: true to open it to the living area, false for its own room"),
  why: z.string().optional().describe("none: a short reason, in the user's language"),
});

export function askPrompt(text: string, layout: Layout) {
  const rooms = layout.floors.flatMap((f) => f.spaces.filter((s) => s.zone !== "circulation").map((s) => `${s.id}: ${s.name} (${s.kind}, ${Math.round(s.rect.w * s.rect.h)} m², ${f.level ? "upstairs" : "ground floor"})`));
  return `A client is changing their floor plan. Turn their request into ONE change.

Rooms:
${rooms.join("\n")}

Changes you can make:
- resize: one room bigger or smaller
- add: a room of one of these kinds: ${ADDABLE.map((a) => a.kind).join(", ")}
- remove: one room
- rename: one room
- kitchen: open the kitchen to the living area, or give it its own room
- none: anything else (style, colours, furniture, moving walls by hand); say briefly why

Request: "${text.slice(0, 300)}"`;
}

/** The change a model reads into the request, or a reason it can't be one. */
export async function ask(text: string, layout: Layout, model: LanguageModel): Promise<Change | { none: string }> {
  // A lookup, not a design: after 8 seconds the screen offers suggestions instead of keeping someone waiting.
  const { output: o } = await generateText({
    model,
    output: Output.object({ schema: Loose }),
    prompt: askPrompt(text, layout),
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(8000),
  });
  const ids = new Set(layout.floors.flatMap((f) => f.spaces.map((s) => s.id)));
  const room = o.room && ids.has(o.room) ? o.room : null;
  if (o.op === "resize" && room) return { op: "resize", room, by: o.bigger === false ? 0.8 : 1.25 };
  if (o.op === "remove" && room) return { op: "remove", room };
  if (o.op === "rename" && room && o.name?.trim()) return { op: "rename", room, name: o.name.trim() };
  if (o.op === "kitchen" && typeof o.open === "boolean") return { op: "kitchen", open: o.open };
  if (o.op === "add") {
    const spec = ADDABLE.find((a) => a.kind === o.kind);
    if (spec) return { op: "add", kind: spec.kind, name: spec.name };
  }
  return { none: o.why?.trim() || "That isn't something I can change on the plan yet." };
}
