import type { Program, SpaceType } from "./schema.ts";

// Starting programs for each space type, in m². The agent adapts them to the interview; tests use them as-is.
export const TEMPLATES: Record<SpaceType, Program> = {
  house: {
    spaceType: "house",
    floors: 2,
    rooms: [
      { id: "living", name: "Living room", kind: "living", area: 24, zone: "public", floor: 0 },
      { id: "kitchen", name: "Kitchen", kind: "kitchen", area: 14, zone: "public", floor: 0 },
      { id: "dining", name: "Dining", kind: "dining", area: 12, zone: "public", floor: 0 },
      { id: "study", name: "Study", kind: "office", area: 10, zone: "private", floor: 0 },
      { id: "powder", name: "Powder room", kind: "bath", area: 4, zone: "service", floor: 0 },
      { id: "laundry", name: "Laundry", kind: "laundry", area: 6, zone: "service", floor: 0 },
      { id: "primary", name: "Primary bedroom", kind: "bedroom", area: 18, zone: "private", floor: 1 },
      { id: "primary-bath", name: "Primary bath", kind: "bath", area: 7, zone: "service", floor: 1 },
      { id: "bed-2", name: "Bedroom 2", kind: "bedroom", area: 12, zone: "private", floor: 1 },
      { id: "bed-3", name: "Bedroom 3", kind: "bedroom", area: 12, zone: "private", floor: 1 },
      { id: "bath-2", name: "Bath", kind: "bath", area: 5, zone: "service", floor: 1 },
      { id: "family", name: "Family room", kind: "living", area: 14, zone: "public", floor: 1 },
    ],
  },
  apartment: {
    spaceType: "apartment",
    floors: 1,
    rooms: [
      { id: "living", name: "Living and dining", kind: "living", area: 26, zone: "public", floor: 0 },
      { id: "kitchen", name: "Kitchen", kind: "kitchen", area: 10, zone: "public", floor: 0 },
      { id: "primary", name: "Bedroom", kind: "bedroom", area: 14, zone: "private", floor: 0 },
      { id: "bed-2", name: "Bedroom 2", kind: "bedroom", area: 11, zone: "private", floor: 0 },
      { id: "bath", name: "Bath", kind: "bath", area: 5, zone: "service", floor: 0 },
    ],
  },
  office: {
    spaceType: "office",
    floors: 1,
    rooms: [
      { id: "reception", name: "Reception", kind: "reception", area: 14, zone: "public", floor: 0 },
      { id: "open-work", name: "Open workspace", kind: "workspace", area: 60, zone: "private", floor: 0 },
      { id: "meeting", name: "Meeting room", kind: "meeting", area: 16, zone: "public", floor: 0 },
      { id: "focus", name: "Focus room", kind: "office", area: 8, zone: "private", floor: 0 },
      { id: "pantry", name: "Pantry", kind: "kitchen", area: 10, zone: "service", floor: 0 },
      { id: "wc", name: "Restroom", kind: "bath", area: 6, zone: "service", floor: 0 },
    ],
  },
  cafe: {
    spaceType: "cafe",
    floors: 1,
    rooms: [
      { id: "seating", name: "Seating", kind: "dining", area: 50, zone: "public", floor: 0 },
      { id: "counter", name: "Counter", kind: "counter", area: 12, zone: "public", floor: 0 },
      { id: "kitchen", name: "Kitchen", kind: "kitchen", area: 18, zone: "service", floor: 0 },
      { id: "store", name: "Store room", kind: "storage", area: 6, zone: "service", floor: 0 },
      { id: "wc", name: "Restroom", kind: "bath", area: 5, zone: "service", floor: 0 },
    ],
  },
  // A typical hotel floor: guest rooms on both sides of the corridor, repeated on every floor.
  hotel: {
    spaceType: "hotel",
    floors: 1,
    rooms: [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `room-${101 + i}`, name: `Room ${101 + i}`, kind: "guest-room", area: 28, zone: "public" as const, floor: 0 })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `room-${107 + i}`, name: `Room ${107 + i}`, kind: "guest-room", area: 28, zone: "private" as const, floor: 0 })),
      { id: "linen", name: "Linen store", kind: "storage", area: 8, zone: "service", floor: 0 },
    ],
  },
  shop: {
    spaceType: "shop",
    floors: 1,
    rooms: [
      { id: "floor", name: "Sales floor", kind: "retail", area: 70, zone: "public", floor: 0 },
      { id: "fitting", name: "Fitting rooms", kind: "fitting", area: 8, zone: "public", floor: 0 },
      { id: "stock", name: "Stock room", kind: "storage", area: 14, zone: "service", floor: 0 },
      { id: "office", name: "Back office", kind: "office", area: 8, zone: "private", floor: 0 },
      { id: "wc", name: "Restroom", kind: "bath", area: 4, zone: "service", floor: 0 },
    ],
  },
  studio: {
    spaceType: "studio",
    floors: 1,
    rooms: [
      { id: "studio", name: "Studio", kind: "workspace", area: 40, zone: "public", floor: 0 },
      { id: "lounge", name: "Lounge", kind: "living", area: 14, zone: "public", floor: 0 },
      { id: "kitchenette", name: "Kitchenette", kind: "kitchen", area: 8, zone: "service", floor: 0 },
      { id: "store", name: "Store", kind: "storage", area: 6, zone: "service", floor: 0 },
      { id: "wc", name: "Restroom", kind: "bath", area: 4, zone: "service", floor: 0 },
    ],
  },
};

// A sensible shell for each template, in metres (width along the street, depth front to back).
export const DEFAULT_SHELLS: Record<SpaceType, { width: number; depth: number }> = {
  house: { width: 14, depth: 10 },
  apartment: { width: 12, depth: 8 },
  office: { width: 16, depth: 10 },
  cafe: { width: 12, depth: 9 },
  hotel: { width: 30, depth: 13 },
  shop: { width: 14, depth: 9 },
  studio: { width: 11, depth: 8 },
};
