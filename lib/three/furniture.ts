import type { Layout, Opening, Space } from "../layout/schema.ts";
import { STOREY } from "./geometry.ts";
import { doorIsOpen, wallPieces } from "../layout/walls.ts";

// Furniture and plants for each room. This file decides what goes where; the 3D view draws each piece
// from its name (a sofa gets a seat, back, arms and cushions; a kitchen counter gets a sink, hob and fridge).
// Role decides the main colour: wood, textile, metal, accent, base, plant or pot.
export type Role = "wood" | "textile" | "metal" | "accent" | "base" | "plant" | "pot";
export type Item = {
  room: string;
  name: string;
  /** World footprint centre and size (x, z, w along x, d along z), used for clearance checks. */
  x: number; z: number; y: number; w: number; d: number; h: number;
  /** The piece's own width and depth before turning, and which way its front faces (radians about y). */
  lw: number; ld: number; rot: number;
  role: Role; level: number;
  /** The kind of room it dresses (feature walls take a different shade in each). */
  kind?: string;
};

// Pieces in room-local terms: fx, fz are fractions of the room (0 = the wall at the room's back), sizes in
// metres. face is the direction the front looks, in room terms: [0, 1] faces into the room (the default),
// [0, -1] faces the back wall, [1, 0] and [-1, 0] face sideways.
// or is a smaller piece to try when this one can't fit around the door.
type Piece = { name: string; fx: number; fz: number; w: number; d: number; h: number; role: Role; lift?: number; face?: [number, number]; or?: Piece };

/** Fallbacks in order: each piece's `or` is the next one. */
const chain = (pieces: Piece[]): Piece => pieces.reduceRight<Piece | undefined>((next, p) => ({ ...p, or: next }), undefined)!;

const bed = (fx = 0.5): Piece[] => [
  { name: "rug", fx, fz: 0.42, w: 2.6, d: 1.9, h: 0.015, role: "accent" },
  {
    name: "bed", fx, fz: 0, w: 2.7, d: 2.05, h: 1.1, role: "textile",
    // Queen with side tables, then a double with tables, a double alone, and a single for a box room.
    or: {
      name: "bed", fx, fz: 0, w: 2.4, d: 1.9, h: 1.1, role: "textile",
      or: { name: "bed", fx, fz: 0, w: 1.5, d: 2.0, h: 1.1, role: "textile", or: { name: "bed", fx, fz: 0, w: 1.0, d: 2.0, h: 1.1, role: "textile" } },
    },
  },
];
const wardrobe: Piece = { name: "wardrobe", fx: 0.96, fz: 0.72, w: 1.5, d: 0.6, h: 2.2, role: "wood", face: [-1, 0] };

const SETS: Record<string, Piece[]> = {
  bedroom: [...bed(0.45), wardrobe, { name: "floor lamp", fx: 0.06, fz: 0.75, w: 0.4, d: 0.4, h: 1.6, role: "metal" }],
  "guest-room": [...bed(0.45), wardrobe, { name: "desk", fx: 0.1, fz: 0.75, w: 1.1, d: 0.55, h: 0.75, role: "wood", face: [1, 0] }],
  living: [
    { name: "rug", fx: 0.5, fz: 0.42, w: 2.8, d: 2.0, h: 0.015, role: "accent" },
    {
      name: "sofa", fx: 0.5, fz: 0.15, w: 2.3, d: 0.95, h: 0.85, role: "textile",
      or: { name: "sofa", fx: 0.5, fz: 0.15, w: 1.6, d: 0.9, h: 0.85, role: "textile" },
    },
    { name: "coffee table", fx: 0.5, fz: 0.42, w: 1.1, d: 0.6, h: 0.42, role: "wood" },
    { name: "armchair", fx: 0.86, fz: 0.42, w: 0.85, d: 0.85, h: 0.85, role: "accent", face: [-1, 0] },
    {
      name: "media unit", fx: 0.5, fz: 0.95, w: 1.9, d: 0.42, h: 1.4, role: "wood", face: [0, -1],
      // A narrower unit beside the door, then a wall-mounted TV on a side wall.
      or: {
        name: "media unit", fx: 0.5, fz: 0.95, w: 1.3, d: 0.4, h: 1.3, role: "wood", face: [0, -1],
        // Beside a window on that wall, then on a side wall.
        or: {
          name: "media unit", fx: 0.18, fz: 0.95, w: 1.3, d: 0.4, h: 1.3, role: "wood", face: [0, -1],
          or: {
            name: "media unit", fx: 0.82, fz: 0.95, w: 1.3, d: 0.4, h: 1.3, role: "wood", face: [0, -1],
            // Then on either side wall, narrower each time. Never standing free in the room: a TV in the middle of
            // an open plan blocks the way in and faces the door with its back (Vicky, 22 Oct).
            // Last, a slim wall-mounted TV anywhere along the walls.
            or: chain([
              ...[1.2, 1.0].flatMap((w) => [0.45, 0.75].flatMap((fz) => [
                { name: "media unit", fx: 0.96, fz, w, d: 0.4, h: 1.3, role: "wood" as const, face: [-1, 0] as [number, number] },
                { name: "media unit", fx: 0.04, fz, w, d: 0.4, h: 1.3, role: "wood" as const, face: [1, 0] as [number, number] },
              ])),
              ...[0.25, 0.5, 0.75].flatMap((at) => [
                { name: "media unit", fx: 0.97, fz: at, w: 0.9, d: 0.15, h: 1.3, role: "wood" as const, face: [-1, 0] as [number, number] },
                { name: "media unit", fx: 0.03, fz: at, w: 0.9, d: 0.15, h: 1.3, role: "wood" as const, face: [1, 0] as [number, number] },
                { name: "media unit", fx: at, fz: 0.97, w: 0.9, d: 0.15, h: 1.3, role: "wood" as const, face: [0, -1] as [number, number] },
              ]),
            ]),
          },
        },
      },
    },
    { name: "floor lamp", fx: 0.1, fz: 0.1, w: 0.4, d: 0.4, h: 1.6, role: "metal" },
    { name: "bookshelf", fx: 0.04, fz: 0.62, w: 0.9, d: 0.35, h: 1.9, role: "wood", face: [1, 0] },
  ],
  lounge: [
    { name: "rug", fx: 0.5, fz: 0.45, w: 2.6, d: 1.8, h: 0.015, role: "accent" },
    { name: "sofa", fx: 0.5, fz: 0.18, w: 2.1, d: 0.95, h: 0.85, role: "textile" },
    { name: "coffee table", fx: 0.5, fz: 0.48, w: 1.0, d: 0.6, h: 0.42, role: "wood" },
    { name: "armchair", fx: 0.5, fz: 0.8, w: 0.85, d: 0.85, h: 0.85, role: "accent", face: [0, -1] },
  ],
  kitchen: [
    {
      name: "kitchen run", fx: 0.5, fz: 0.07, w: 3.8, d: 0.65, h: 2.3, role: "base",
      // If the back of the kitchen opens to the living area, the run goes on a side wall instead.
      // When doors break up every wall (a kitchen that rooms open off), a shorter run fits between them.
      or: chain([3.4, 2.4, 1.8].flatMap((w) => [
        ...(w < 3.4 ? [{ name: "kitchen run", fx: 0.5, fz: 0.07, w, d: 0.65, h: 2.3, role: "base" as const }] : []),
        { name: "kitchen run", fx: 0.96, fz: 0.5, w, d: 0.65, h: 2.3, role: "base" as const, face: [-1, 0] as [number, number] },
        { name: "kitchen run", fx: 0.04, fz: 0.5, w, d: 0.65, h: 2.3, role: "base" as const, face: [1, 0] as [number, number] },
      ])),
    },
    {
      name: "island", fx: 0.5, fz: 0.58, w: 1.9, d: 1.5, h: 0.95, role: "wood",
      or: { name: "cafe table", fx: 0.5, fz: 0.58, w: 1.2, d: 1.2, h: 0.95, role: "wood" },
    },
  ],
  dining: [
    {
      name: "dining set", fx: 0.5, fz: 0.5, w: 2.0, d: 2.0, h: 2.8, role: "wood",
      // Six seats, then four, then a table for two, so a dining room never ends up empty.
      or: {
        name: "dining set", fx: 0.5, fz: 0.55, w: 1.6, d: 1.6, h: 2.8, role: "wood",
        or: { name: "dining set", fx: 0.5, fz: 0.4, w: 1.3, d: 1.3, h: 2.8, role: "wood" },
      },
    },
    { name: "sideboard", fx: 0.5, fz: 0.04, w: 1.6, d: 0.45, h: 0.8, role: "wood" },
  ],
  bath: [
    { name: "vanity", fx: 0.28, fz: 0.08, w: 0.9, d: 0.5, h: 1.9, role: "wood" },
    { name: "shower", fx: 0.8, fz: 0.25, w: 0.95, d: 0.95, h: 2.1, role: "base" },
    {
      name: "toilet", fx: 0.8, fz: 0.75, w: 0.42, d: 0.68, h: 0.8, role: "base", face: [-1, 0],
      or: { name: "toilet", fx: 0.2, fz: 0.75, w: 0.42, d: 0.68, h: 0.8, role: "base", face: [1, 0] },
    },
  ],
  office: [
    {
      name: "desk", fx: 0.5, fz: 0.1, w: 1.5, d: 0.7, h: 0.75, role: "wood",
      or: { name: "desk", fx: 0.2, fz: 0.1, w: 1.1, d: 0.6, h: 0.75, role: "wood" },
    },
    { name: "office chair", fx: 0.5, fz: 0.3, w: 0.6, d: 0.6, h: 1.05, role: "metal", face: [0, -1] },
    { name: "bookshelf", fx: 0.9, fz: 0.75, w: 0.9, d: 0.35, h: 1.9, role: "wood", face: [-1, 0] },
    { name: "rug", fx: 0.5, fz: 0.3, w: 1.6, d: 1.2, h: 0.015, role: "accent" },
  ],
  workspace: [
    { name: "desk row", fx: 0.5, fz: 0.25, w: 3.2, d: 1.6, h: 1.05, role: "wood" },
    { name: "desk row", fx: 0.5, fz: 0.68, w: 3.2, d: 1.6, h: 1.05, role: "wood" },
  ],
  meeting: [
    { name: "meeting set", fx: 0.5, fz: 0.5, w: 3.2, d: 2.2, h: 1.05, role: "wood" },
    { name: "wall screen", fx: 0.5, fz: 0.02, w: 1.6, d: 0.06, h: 0.95, role: "metal", lift: 1.0 },
  ],
  reception: [
    { name: "reception desk", fx: 0.5, fz: 0.25, w: 2.2, d: 0.75, h: 1.1, role: "wood", face: [0, 1] },
    { name: "sofa", fx: 0.5, fz: 0.85, w: 2.0, d: 0.9, h: 0.85, role: "textile", face: [0, -1] },
  ],
  counter: [
    { name: "service counter", fx: 0.5, fz: 0.3, w: 2.8, d: 0.75, h: 1.1, role: "wood" },
    { name: "cafe table", fx: 0.3, fz: 0.75, w: 1.3, d: 1.3, h: 0.95, role: "wood" },
    { name: "cafe table", fx: 0.72, fz: 0.75, w: 1.3, d: 1.3, h: 0.95, role: "wood" },
  ],
  retail: [
    { name: "display table", fx: 0.35, fz: 0.5, w: 1.6, d: 0.9, h: 0.9, role: "wood" },
    { name: "display table", fx: 0.7, fz: 0.5, w: 1.6, d: 0.9, h: 0.9, role: "wood" },
    { name: "shelving", fx: 0.5, fz: 0.05, w: 2.4, d: 0.45, h: 2.0, role: "wood" },
  ],
  fitting: [{ name: "mirror", fx: 0.5, fz: 0.03, w: 0.7, d: 0.05, h: 1.7, role: "metal", lift: 0.2 }],
  laundry: [
    { name: "washer", fx: 0.25, fz: 0.1, w: 0.62, d: 0.62, h: 0.86, role: "base" },
    { name: "washer", fx: 0.48, fz: 0.1, w: 0.62, d: 0.62, h: 0.86, role: "base" },
  ],
  storage: [{ name: "shelving", fx: 0.5, fz: 0.1, w: 1.2, d: 0.45, h: 2.0, role: "metal" }],
};

// A plant in a free corner: the far corners first, then the near ones.
const PLANT: Piece = {
  name: "plant", fx: 0.94, fz: 0.08, w: 0.55, d: 0.55, h: 1.3, role: "plant",
  or: {
    name: "plant", fx: 0.06, fz: 0.08, w: 0.55, d: 0.55, h: 1.3, role: "plant",
    or: {
      name: "plant", fx: 0.94, fz: 0.92, w: 0.5, d: 0.5, h: 1.1, role: "plant",
      or: { name: "plant", fx: 0.06, fz: 0.92, w: 0.5, d: 0.5, h: 1.1, role: "plant", or: { name: "plant", fx: 0.94, fz: 0.5, w: 0.4, d: 0.4, h: 0.9, role: "plant" } },
    },
  },
};
// A taste that leans green (gardens, botanical places) gets a second, smaller plant in the opposite corner.
const LUSH_PLANT: Piece = { name: "plant", fx: 0.06, fz: 0.92, w: 0.45, d: 0.45, h: 0.9, role: "plant" };
const PLANTED = new Set(["living", "lounge", "bedroom", "guest-room", "dining", "office"]);
const LUSH_ROOMS = new Set(["living", "lounge", "bedroom"]);

// Plants the client added to raise the greenery score: every corner, then the middle of each wall, so each one
// finds the next free spot. The usual plant above is untouched, so a design without additions stays the same.
const SPOTS: [number, number][] = [[0.94, 0.08], [0.06, 0.08], [0.94, 0.92], [0.06, 0.92], [0.5, 0.06], [0.06, 0.5], [0.94, 0.5], [0.5, 0.94]];
// When the floor is full (a bedroom with its bed and wardrobe), a plant goes on a wall shelf above the furniture.
const SHELVES: [number, number, [number, number]][] = [
  [0.25, 0.02, [0, 1]], [0.75, 0.02, [0, 1]], [0.02, 0.3, [1, 0]], [0.98, 0.3, [-1, 0]],
  [0.02, 0.7, [1, 0]], [0.98, 0.7, [-1, 0]], [0.25, 0.98, [0, -1]], [0.75, 0.98, [0, -1]],
];
const EXTRA_PLANT: Piece = chain([
  ...SPOTS.map(([fx, fz]) => ({ name: "plant", fx, fz, w: 0.45, d: 0.45, h: 1.0, role: "plant" as const })),
  ...SHELVES.map(([fx, fz, face]) => ({ name: "wall plant", fx, fz, w: 0.4, d: 0.25, h: 0.45, role: "plant" as const, lift: 1.75, face })),
]);

// The room's "back" is the wall facing its door, so furniture sits against it and the door stays clear.
type Frame = { origin: number[]; u: number[]; v: number[]; W: number; D: number };

/** The room's four possible orientations, one with its back to each wall. */
function frames(room: Space): Frame[] {
  const { x, y, w, h } = room.rect;
  return [
    { origin: [x, y], u: [1, 0], v: [0, 1], W: w, D: h },
    { origin: [x + w, y + h], u: [-1, 0], v: [0, -1], W: w, D: h },
    { origin: [x, y + h], u: [0, -1], v: [1, 0], W: h, D: w },
    { origin: [x + w, y], u: [0, 1], v: [-1, 0], W: h, D: w },
  ];
}

export function orient(room: Space, door: Opening | undefined): Frame {
  const { x, y, w, h } = room.rect;
  if (!door) return { origin: [x, y], u: [1, 0], v: [0, 1], W: w, D: h };
  if (door.axis === "x") {
    const doorAtTop = Math.abs(door.y - y) < 1e-6;
    return doorAtTop ? { origin: [x + w, y + h], u: [-1, 0], v: [0, -1], W: w, D: h } : { origin: [x, y], u: [1, 0], v: [0, 1], W: w, D: h };
  }
  const doorAtLeft = Math.abs(door.x - x) < 1e-6;
  return doorAtLeft ? { origin: [x + w, y], u: [0, 1], v: [-1, 0], W: h, D: w } : { origin: [x, y + h], u: [0, -1], v: [1, 0], W: h, D: w };
}

const overlaps = (a: { x: number; z: number; w: number; d: number }, b: { x: number; z: number; w: number; d: number }) =>
  Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.z - b.z) * 2 < a.d + b.d;

/** The space a door needs kept clear inside the room: 0.85 m for a real door, 0.6 m to walk through an open-plan gap. */
export function doorClearance(door: Opening, room: Space, open = false) {
  const into = open ? 0.6 : 0.85;
  const cx = room.rect.x + room.rect.w / 2;
  const cz = room.rect.y + room.rect.h / 2;
  if (door.axis === "x") return { x: door.x, z: door.y + (cz > door.y ? into / 2 : -into / 2), w: door.width + 0.4, d: into };
  return { x: door.x + (cx > door.x ? into / 2 : -into / 2), z: door.y, w: into, d: door.width + 0.4 };
}

type Box = { x: number; z: number; w: number; d: number };
function slideClear(box: Box, clear: Box, room: Space, alongZ: boolean): Box | null {
  const { x, y, w, h } = room.rect;
  // Pieces slide along the wall they stand against.
  const options = alongZ
    ? [clear.z - clear.d / 2 - box.d / 2 - 0.02, clear.z + clear.d / 2 + box.d / 2 + 0.02].map((z) => ({ ...box, z }))
    : [clear.x - clear.w / 2 - box.w / 2 - 0.02, clear.x + clear.w / 2 + box.w / 2 + 0.02].map((nx) => ({ ...box, x: nx }));
  return (
    options.find((b) => b.x - b.w / 2 >= x && b.x + b.w / 2 <= x + w && b.z - b.d / 2 >= y && b.z + b.d / 2 <= y + h && !overlaps(b, clear)) ?? null
  );
}

// Pieces that stand with their back to a wall, so it must be a real wall, not an open-plan edge.
const AGAINST_WALL = new Set(["bookshelf", "wardrobe", "media unit", "sideboard", "kitchen run", "shelving", "vanity", "washer", "mirror", "wall screen", "bed", "wall plant"]);
// Tall pieces that would cover a window. (A kitchen run is fine: the sink goes under the window.)
const TALL = new Set(["bookshelf", "wardrobe", "media unit", "shelving", "mirror", "wall screen"]);
const SILL_HEIGHT = 0.9;

/** `extraPlants`: plants added to rooms (by room id) to raise the greenery score. */
export function furnish(layout: Layout, { lush = false, extraPlants = {} as Record<string, number> } = {}): Item[] {
  const items: Item[] = [];
  for (const floor of layout.floors) {
    const base = floor.level * STOREY;
    const pieces = wallPieces(floor, layout.shell);
    for (const room of floor.spaces.filter((s) => s.zone !== "circulation")) {
      const door = floor.openings.find((o) => o.type === "door" && o.between[0] === room.id);
      // Keep every doorway into this room clear, not only its own door: a bedroom that opens off the kitchen
      // needs the kitchen side of its door free too. 0.85 m into the room, a little wider than the door.
      const clears = floor.openings.filter((o) => o.type === "door" && o.between.includes(room.id)).map((o) => doorClearance(o, room, doorIsOpen(o, pieces)));
      // The wall behind a piece facing (dx, dz): is it solid along the piece's whole width, and free of windows?
      const wallOk = (box: Box, dx: number, dz: number, keepWindows: boolean) => {
        const { x, y, w, h } = room.rect;
        const alongX = dz !== 0;
        const back = alongX ? box.z - dz * (box.d / 2) : box.x - dx * (box.w / 2);
        const edge = alongX ? (dz > 0 ? y : y + h) : dx > 0 ? x : x + w;
        if (Math.abs(back - edge) > 0.2) return true; // stands free in the room, not against a wall
        const [from, to] = alongX ? [box.x - box.w / 2, box.x + box.w / 2] : [box.z - box.d / 2, box.z + box.d / 2];
        const solid = pieces
          .filter((q) => !q.open && q.axis === (alongX ? "x" : "z") && Math.abs(q.at - edge) < 1e-6)
          .reduce((t, q) => t + Math.max(0, Math.min(to, q.to) - Math.max(from, q.from)), 0);
        if (solid < to - from - 1e-3) return false;
        if (!keepWindows) return true;
        return !floor.openings.some((o) => {
          if (o.type !== "window" || o.axis !== (alongX ? "x" : "y")) return false;
          const line = alongX ? o.y : o.x;
          const mid = alongX ? o.x : o.y;
          return Math.abs(line - edge) < 1e-6 && Math.min(to, mid + o.width / 2) - Math.max(from, mid - o.width / 2) > 1e-6;
        });
      };
      // Furnish the room with its "back" on one wall. The usual back is the wall facing the door; when that
      // leaves out something essential (a TV with no solid wall to stand on, say), the other walls are tried
      // and the arrangement that fits the essentials wins.
      const furnishAs = ({ origin, u, v, W, D }: Frame): Item[] => {
      const roomItems: Item[] = [];
      const placed: Box[] = [];
      const shelves: Box[] = [];
      const place = (p: Piece): void => {
        const [fu, fv] = p.face ?? [0, 1];
        const sideways = fu !== 0;
        // The piece's own size, shrunk to fit the room, then its footprint along the room's u and v.
        const lw = Math.min(p.w, (sideways ? D : W) - 0.3);
        const ld = Math.min(p.d, (sideways ? W : D) - 0.3);
        if (lw <= 0.2 || ld <= 0.2) return p.or && place(p.or);
        const [su, sv] = sideways ? [ld, lw] : [lw, ld];
        // 0.11 m keeps pieces clear of the wall itself (an outside wall is 0.2 m thick, centred on the edge).
        const lx = Math.min(Math.max(p.fx * W, su / 2 + 0.11), W - su / 2 - 0.11);
        const lz = Math.min(Math.max(p.fz * D, sv / 2 + 0.11), D - sv / 2 - 0.11);
        const X = origin[0] + u[0] * lx + v[0] * lz;
        const Z = origin[1] + u[1] * lx + v[1] * lz;
        const turned = u[0] === 0; // the room's u runs along world z
        let box = { x: X, z: Z, w: turned ? sv : su, d: turned ? su : sv };
        const blocking = clears.find((c) => overlaps(box, c));
        if (blocking) {
          // Slide the piece along its wall to clear the door; drop it only if it can't fit either side, or if
          // sliding puts it in front of another door.
          const moved = slideClear(box, blocking, room, turned !== sideways);
          if (!moved || clears.some((c) => overlaps(moved, c))) return p.or && place(p.or);
          box = moved;
        }
        // World direction of the piece's front, as a turn about y (0 faces +z).
        const dx = u[0] * fu + v[0] * fv;
        const dz = u[1] * fu + v[1] * fv;
        // A piece backed against a wall needs a solid wall there, clear of windows if it's tall.
        if (AGAINST_WALL.has(p.name) && !wallOk(box, dx, dz, (p.lift ?? 0) + p.h > SILL_HEIGHT && TALL.has(p.name))) return p.or && place(p.or);
        // Nothing stands inside anything else (a rug lies under things, so it doesn't count).
        // A wall plant hangs above the furniture, so it only has to miss other wall plants.
        const high = p.name === "wall plant";
        if (p.name !== "rug" && (high ? shelves : placed).some((q) => overlaps(box, q))) return p.or && place(p.or);
        if (p.name !== "rug") (high ? shelves : placed).push(box);
        roomItems.push({ room: room.id, name: p.name, ...box, y: base + (p.lift ?? 0), h: p.h, lw, ld, rot: Math.atan2(dx, dz), role: p.role, level: floor.level });
      };
      // A powder room, WC or restroom is a half bath: toilet and basin, no shower.
      const half = room.kind === "bath" && /powder|wc|restroom|toilet/i.test(room.name);
      // One plant to a room, where people sit or sleep; a lush taste adds a second in living rooms and bedrooms only,
      // so an open plan doesn't fill up with pots (kitchens, halls and wet rooms keep their floors clear).
      const green = PLANTED.has(room.kind) || !HOMES.has(layout.spaceType);
      const plants = green ? [PLANT, ...(lush && LUSH_ROOMS.has(room.kind) ? [LUSH_PLANT] : [])] : [];
      for (const p of [...setFor(room, layout.spaceType, W, D).filter((q) => !(half && q.name === "shower")), ...plants, ...Array<Piece>(extraPlants[room.id] ?? 0).fill(EXTRA_PLANT)]) place(p);
      return roomItems;
      };
      const needs = essentialsFor(room.kind, layout.spaceType);
      const missing = (its: Item[]) => needs.filter((n) => !its.some((i) => i.name === n)).length;
      // a sofa that looks at the TV, not past it
      const facing = (its: Item[]) => {
        const sofa = its.find((i) => i.name === "sofa");
        const tv = its.find((i) => i.name === "media unit");
        return !!sofa && !!tv && Math.cos(sofa.rot - tv.rot) < -0.99;
      };
      let best: Item[] = [];
      let bestScore = -Infinity;
      for (const frame of [orient(room, door), ...frames(room)]) {
        const its = furnishAs(frame);
        // somewhere to sit matters more than the TV
        const seated = !needs.includes("sofa") || its.some((i) => i.name === "sofa");
        const score = -missing(its) * 100 - (seated ? 0 : 60) + (facing(its) ? 50 : 0) + its.length;
        if (score > bestScore) [best, bestScore] = [its, score];
        if (missing(its) === 0 && frame === undefined) break;
      }
      items.push(...best);
    }
  }
  return items;
}

const HOMES = new Set(["house", "apartment", "studio"]);

/**
 * The pieces for one room. Homes use the room's set as it is. A café or restaurant's dining room is seating:
 * a grid of small tables, 1.8 m apart, instead of one family dining table; a business kitchen has no table.
 */
function setFor(room: Space, spaceType: string, W: number, D: number): Piece[] {
  const base = SETS[room.kind] ?? [];
  if (HOMES.has(spaceType)) return base;
  const noHomeFallback = (p: Piece): Piece => (p.or?.name === "cafe table" ? { ...p, or: undefined } : { ...p, or: p.or && noHomeFallback(p.or) });
  if (room.kind === "kitchen") return base.map(noHomeFallback);
  // A counter runs along the back of the room with a back bar on the wall behind it, room to work between them, and
  // the rest of the room is seating; never a counter standing in the middle of the floor.
  if (room.kind === "counter" && (spaceType === "cafe" || spaceType === "restaurant")) {
    const bar: Piece[] = [
      { name: "shelving", fx: 0.5, fz: 0, w: Math.min(2.4, W - 0.8), d: 0.45, h: 2.0, role: "wood" },
      { name: "service counter", fx: 0.5, fz: 1.55 / D, w: Math.min(3.4, W - 1.2), d: 0.75, h: 1.1, role: "wood" },
    ];
    return [...bar, ...tableGrid(W, D, 2.5)];
  }
  if (room.kind !== "dining") return base;
  return tableGrid(W, D, 0);
}

/** Small tables for two in rows, 1.7 m apart, filling the room from `from` metres off its back wall. */
function tableGrid(W: number, D: number, from: number): Piece[] {
  const cols = Math.max(1, Math.floor((W - 0.4) / 1.7));
  const rows = Math.max(from ? 0 : 1, Math.floor((D - from - 0.3) / 1.7));
  const tables: Piece[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      tables.push({ name: "cafe table", fx: (c + 0.5) / cols, fz: (from + 0.15 + (r + 0.5) * ((D - from - 0.3) / rows)) / D, w: 1.3, d: 1.1, h: 0.95, role: "wood" });
  return tables;
}

// What makes a room usable: a living room needs somewhere to sit and a TV, a dining room a table, and so on.
export const ESSENTIALS: Record<string, string[]> = {
  // A TV is tried on every wall, but a room with no wall free for one goes without rather than have it stand in the way.
  living: ["sofa"],
  dining: ["dining set"],
  bedroom: ["bed"],
  "guest-room": ["bed"],
  kitchen: ["kitchen run"],
  bath: ["toilet"],
  office: ["desk"],
};

/** A café's seating needs tables to sit at; everything else as for a home. */
export const essentialsFor = (kind: string, spaceType: string) =>
  !HOMES.has(spaceType) && kind === "dining" ? ["cafe table"] : kind === "counter" && (spaceType === "cafe" || spaceType === "restaurant") ? ["service counter"] : (ESSENTIALS[kind] ?? []);

/** The essentials each room is missing, as "room-id: piece". Empty means every room is usable. */
export function missingEssentials(layout: Layout, items: Item[] = furnish(layout)): string[] {
  const out: string[] = [];
  for (const f of layout.floors)
    for (const room of f.spaces)
      for (const need of essentialsFor(room.kind, layout.spaceType))
        if (!items.some((i) => i.room === room.id && i.level === f.level && i.name === need)) out.push(`${room.id}: ${need}`);
  return out;
}
