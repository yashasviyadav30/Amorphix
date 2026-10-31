import { z } from "zod";

// The taste a browser read on the device (signals and profile), as the server accepts it.
const layer = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export const TasteBody = z.object({
  signals: z.array(z.object({ entityId: z.string().max(120), name: z.string().max(120), layer, type: z.string().max(20).optional() })).min(1).max(12),
  profile: z.object({
    tags: z.array(
      z.object({
        family: z.enum(["decor", "ambience", "aesthetic", "tone", "style"]),
        value: z.string().max(60),
        weight: z.number(),
        sources: z.array(z.object({ entityId: z.string().max(120), name: z.string().max(120), layer })).max(12),
      }),
    ).max(200),
    brands: z.array(z.object({ id: z.string().max(80), name: z.string().max(80), affinity: z.number(), aesthetic: z.array(z.string().max(60)).max(10), because: z.array(z.object({ entityId: z.string().max(120), score: z.number() })).max(12) })).max(40),
  }),
});
export type TasteBody = z.infer<typeof TasteBody>;
