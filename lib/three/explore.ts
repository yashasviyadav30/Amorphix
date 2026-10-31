import type { Layout } from "../layout/schema.ts";
import { buildWalls, STOREY } from "./geometry.ts";

// Free walking inside the model: the walls a person can't pass on one floor, and a step that stops at
// them. Door gaps have only a lintel above head height, so they stay open; window sills block.

export type Rect = { x0: number; x1: number; z0: number; z1: number };
const BODY = 0.25; // a person's radius, in metres

export function blockers(layout: Layout, level: number): Rect[] {
  return buildWalls(layout)
    .walls.filter((w) => w.level === level && Math.abs(w.y0 - level * STOREY) < 1e-6)
    .map((w) =>
      w.axis === "x"
        ? { x0: w.from, x1: w.to, z0: w.at - w.thick / 2, z1: w.at + w.thick / 2 }
        : { x0: w.at - w.thick / 2, x1: w.at + w.thick / 2, z0: w.from, z1: w.to },
    );
}

const hits = (x: number, z: number, walls: Rect[], r: number) => walls.some((b) => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r);

/** Where a step from (x, z) by (dx, dz) ends: the full step, or a slide along the wall, or no move. */
export function step(x: number, z: number, dx: number, dz: number, walls: Rect[], r = BODY): [number, number] {
  // Short sub-steps, so a fast step can't jump through a thin wall.
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.05));
  for (let i = 0; i < n; i++) {
    const sx = dx / n;
    const sz = dz / n;
    if (!hits(x + sx, z + sz, walls, r)) {
      x += sx;
      z += sz;
    } else if (!hits(x + sx, z, walls, r)) x += sx;
    else if (!hits(x, z + sz, walls, r)) z += sz;
    else break;
  }
  return [x, z];
}

/**
 * Pieces of a walk that pass through a solid wall: each segment is sampled every 5 cm and every sample must
 * be clear of the walls of the floor it's on. Climbs between floors (the eye height changes) are checked
 * on the floor they start from. Empty means the walk never goes through a wall.
 */
export function wallCrossings(layout: Layout, path: [number, number, number][], eye = 1.6): string[] {
  const walls = new Map(layout.floors.map((f) => [f.level, blockers(layout, f.level)]));
  const out: string[] = [];
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]];
    const level = Math.max(0, Math.round((a[1] - eye) / STOREY));
    const ws = walls.get(level) ?? [];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.05));
    for (let k = 0; k <= n; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / n;
      const z = a[2] + ((b[2] - a[2]) * k) / n;
      if (ws.some((w) => x > w.x0 + 1e-6 && x < w.x1 - 1e-6 && z > w.z0 + 1e-6 && z < w.z1 - 1e-6)) {
        out.push(`segment ${i} (${x.toFixed(2)}, ${z.toFixed(2)}) on floor ${level}`);
        break;
      }
    }
  }
  return out;
}
