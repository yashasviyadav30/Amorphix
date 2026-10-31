import type { Program, Shell } from "./schema.ts";

// A building rarely fills its lot: there's a front setback and a garden. Size the building to its rooms,
// keep the lot's proportions, and leave the rest of the lot as outdoor space.
const CIRCULATION = 1.25; // rooms plus a quarter for the hall and walls
export const STAIRWELL = 10; // m² for a turning stair and its landings, on every floor of a two-storey building
const MIN_SIDE = 8; // two rows of rooms deep enough for a bed and its door, plus the hall

// `grow` makes the building that much bigger than the rooms strictly need, when the lot has room for it.
export function buildingShell(program: Program, lot: Shell, grow = 1): Shell {
  const perFloor = Array.from({ length: program.floors }, (_, f) => program.rooms.filter((r) => r.floor === f).reduce((t, r) => t + r.area, 0));
  const need = (Math.max(...perFloor) * CIRCULATION + (program.floors > 1 ? STAIRWELL : 0)) * grow;
  const lotArea = lot.width * lot.depth;
  if (need >= lotArea) return lot;
  const s = Math.sqrt(need / lotArea);
  const round = (v: number) => Math.round(v * 10) / 10;
  return { width: round(Math.min(lot.width, Math.max(MIN_SIDE, lot.width * s))), depth: round(Math.min(lot.depth, Math.max(MIN_SIDE, lot.depth * s))) };
}
