import type { Layout } from "../layout/schema.ts";
import type { ReadPlan } from "./snap.ts";

// The user's corrections to a read plan. Pure, so the check screen can preview them in the browser.

export type Imported = { read: ReadPlan; layout: Layout; problems: string[]; advice: string[]; questions: string[]; confirmed?: boolean };

export const importedOf = (interview: Record<string, unknown> | null | undefined): Imported | null =>
  (interview?.imported as Imported | undefined) ?? null;

/** A validator message in the user's words: room names instead of ids, "Ground floor" instead of "floor 0". */
export function plainProblem(message: string, layout: Layout): string {
  const names = new Map(layout.floors.flatMap((f) => f.spaces.map((s) => [s.id, s.name] as const)));
  return message
    .replace(/^floor 0:/, "Ground floor:")
    .replace(/^floor 1:/, "Upstairs:")
    .replace(/\b(door|win)-([a-z0-9-]+)/g, (_, kind: string, id: string) => `the ${kind === "win" ? "window" : "door"} of ${names.get(id) ?? id}`)
    .replace(/\b[a-z0-9]+(?:-[a-z0-9]+)*\b/g, (w) => names.get(w) ?? w);
}

export const ZONES: Record<string, "public" | "private" | "service"> = {
  living: "public", lounge: "public", kitchen: "public", dining: "public", reception: "public", retail: "public", counter: "public", meeting: "public",
  bedroom: "private", "guest-room": "private", office: "private", workspace: "private",
  bath: "service", laundry: "service", storage: "service", closet: "service", pantry: "service",
};

export type Edit = { id: string; name?: string; kind?: string };

/** The user's corrections: a room renamed, or its type changed (which also moves it to the right zone). */
export function applyEdits(layout: Layout, edits: Edit[]): Layout {
  const byId = new Map(edits.map((e) => [e.id, e]));
  return {
    ...layout,
    floors: layout.floors.map((f) => ({
      ...f,
      spaces: f.spaces.map((s) => {
        const e = byId.get(s.id);
        if (!e || s.zone === "circulation") return s;
        const kind = e.kind && ZONES[e.kind] ? e.kind : s.kind;
        return { ...s, name: e.name?.trim() || s.name, kind, zone: ZONES[kind] ?? s.zone };
      }),
    })),
  };
}

/** A reading scaled to the size the user gave afterwards. */
export function rescale(read: ReadPlan, width: number, depth: number): ReadPlan {
  const fx = width / read.width;
  const fy = depth / read.depth;
  return { ...read, width, depth, rooms: read.rooms.map((r) => ({ ...r, x: r.x * fx, y: r.y * fy, w: r.w * fx, h: r.h * fy })) };
}

