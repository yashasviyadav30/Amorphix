import type { Layout } from "../layout/schema.ts";

// A light drawing of a design for the cards on the home page: the ground floor's rooms as rectangles, in metres,
// small enough to send with every card. Corridors and stairs are drawn too, but not named.

export type Sketch = { w: number; d: number; floors: number; rooms: { x: number; y: number; w: number; h: number; name: string | null }[] };

const r1 = (n: number) => Math.round(n * 10) / 10;

export function sketchOf(layout: Layout | null | undefined): Sketch | null {
  const floor = layout?.floors.find((f) => f.level === 0) ?? layout?.floors[0];
  if (!layout || !floor?.spaces.length) return null;
  return {
    w: r1(layout.shell.width),
    d: r1(layout.shell.depth),
    floors: layout.floors.length,
    rooms: floor.spaces.map((s) => ({
      x: r1(s.rect.x),
      y: r1(s.rect.y),
      w: r1(s.rect.w),
      h: r1(s.rect.h),
      name: s.kind === "corridor" || s.kind === "stairs" ? null : s.name,
    })),
  };
}
