// The three taste questions on the check screen. Each answer is a name the user loves; the browser reads it into the
// taste profile, the same way the interview does.

export const SLOTS = [
  { id: "place", label: "A hotel, café or restaurant you love", example: "Ace Hotel New York" },
  { id: "brand", label: "A brand whose things you love using", example: "Muji" },
  { id: "media", label: "A film, show or music you love", example: "Interstellar" },
] as const;
export type SlotId = (typeof SLOTS)[number]["id"];

export type Pick = { slot: SlotId; id: string; name: string };
