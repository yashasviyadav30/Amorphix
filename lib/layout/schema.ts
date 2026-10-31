import { z } from "zod";

// All geometry is in metres. The UI converts to feet and inches.

export const Zone = z.enum(["public", "private", "service"]);
export type Zone = z.infer<typeof Zone>;

export const SpaceType = z.enum(["house", "apartment", "office", "cafe", "hotel", "shop", "studio"]);
export type SpaceType = z.infer<typeof SpaceType>;

// What the LLM writes: the rooms a project needs, not where they go.
export const ProgramRoom = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  kind: z.string(), // bedroom, kitchen, bath, living, office, guest-room, ...
  area: z.number().positive(), // target m²; scaled to fit the shell
  zone: Zone,
  floor: z.number().int().min(0).max(1).default(0),
});
export type ProgramRoom = z.infer<typeof ProgramRoom>;

export const Program = z.object({
  spaceType: SpaceType,
  floors: z.number().int().min(1).max(2),
  rooms: z.array(ProgramRoom).min(1),
});
export type Program = z.infer<typeof Program>;

export const Shell = z.object({
  width: z.number().positive(), // along x, the street side
  depth: z.number().positive(), // along y, front (y = 0) to back
});
export type Shell = z.infer<typeof Shell>;

export const Rect = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
export type Rect = z.infer<typeof Rect>;

// What the engine writes and every view reads: 2D plan, 3D, budget, greenery, drawings.
export const Space = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(), // room kinds plus "corridor" and "stairs"
  zone: z.union([Zone, z.literal("circulation")]),
  rect: Rect,
  /** Overrides whether the room opens into its neighbours, e.g. a closed kitchen for someone who asked for one. */
  open: z.boolean().optional(),
});
export type Space = z.infer<typeof Space>;

// An opening sits on one wall segment. `between` names the two spaces it joins; "outside" is the street or garden.
export const Opening = z.object({
  id: z.string(),
  type: z.enum(["door", "window"]),
  between: z.tuple([z.string(), z.string()]),
  x: z.number(), // centre point
  y: z.number(),
  axis: z.enum(["x", "y"]), // the direction the wall runs
  width: z.number().positive(),
});
export type Opening = z.infer<typeof Opening>;

export const Floor = z.object({
  level: z.number().int(),
  spaces: z.array(Space),
  openings: z.array(Opening),
});
export type Floor = z.infer<typeof Floor>;

export const Layout = z.object({
  spaceType: SpaceType,
  shell: Shell,
  floors: z.array(Floor).min(1),
  /** The layout idea behind this option, and why it fits this client (quoting their answers or loves). */
  concept: z.object({ id: z.string(), name: z.string(), summary: z.string().optional(), why: z.array(z.string()) }).optional(),
});
export type Layout = z.infer<typeof Layout>;
