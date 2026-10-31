import type { Layout, Space } from "../layout/schema.ts";
import { ADDABLE, type Change } from "./edit.ts";

// What someone types or says in the workspace, read into a change with plain rules, in English, Hindi or Hinglish:
// "make the kitchen bigger", "add a study", "guest room hatao", "rename bedroom 2 to kids room". Instant, so most
// edits never wait on a model; anything it can't read comes back as null.

const norm = (s: string) =>
  ` ${s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim()} `;

// Words for each kind of room, in the three languages.
const KIND_WORDS: Record<string, string[]> = {
  kitchen: ["kitchen", "rasoi", "pantry", "kitchenette", "रसोई", "किचन"],
  living: ["living", "lounge", "drawing room", "sitting room", "family room", "hangout", "लिविंग"],
  dining: ["dining", "seating", "seats", "tables", "to sit", "sit down", "eat", "डाइनिंग"],
  counter: ["counter", "service counter", "till", "cash"],
  retail: ["sales floor", "shop floor", "retail", "display", "showroom"],
  reception: ["reception", "lobby", "waiting", "front desk"],
  fitting: ["fitting", "trial room", "changing room", "ट्रायल"],
  workspace: ["workspace", "desks", "open office", "work area"],
  bedroom: ["bedroom", "bed room", "kids", "kid s", "children", "sleep", "बेडरूम", "कमरा"],
  "guest-room": ["guest room", "guest bedroom", "गेस्ट रूम"],
  bath: ["bathroom", "bath", "toilet", "washroom", "restroom", "बाथरूम", "शौचालय"],
  office: ["study", "office", "home office", "स्टडी", "ऑफ़िस"],
  prayer: ["prayer", "pooja", "puja", "mandir", "पूजा", "मंदिर"],
  gym: ["gym", "yoga", "workout", "exercise", "fitness", "जिम", "योग"],
  media: ["media", "theatre", "theater", "tv room"],
  storage: ["store room", "storage", "store", "स्टोर"],
  laundry: ["laundry", "utility"],
  meeting: ["meeting", "conference", "मीटिंग"],
};

const has = (t: string, words: RegExp) => words.test(t);
const BIGGER = / (bigger|larger|more space|more room|roomier|spacious|increase|expand|enlarge|wider|grow|bada|badi|bara|bari|zyada|jyada|jagah|बड़ा|बड़ी|ज़्यादा|जगह) /;
const MUCH = / (much|a lot|lot|double|bahut|kaafi|बहुत) /;
const SMALLER = / (smaller|reduce|shrink|less space|tighter|chhota|chota|chhoti|choti|kam|छोटा|छोटी|कम) /;
const REMOVE = / (remove|delete|get rid|drop|don t need|dont need|do not need|no need for|hatao|hata do|hatado|nikal|nikalo|nahi chahiye|हटाओ|हटा दो|नहीं चाहिए) /;
const ADD = / (add|need|want|include|put in|give me|somewhere to|a place to|space for a|room for a|chahiye|banao|bana do|jodo|add karo|जोड़ो|चाहिए|बनाओ) /;

/** The room the words name: by its own name first ("bedroom 2"), then by kind ("the kitchen", "main bedroom"). */
export function roomIn(text: string, layout: Layout): Space | null {
  const t = norm(text);
  const rooms = layout.floors.flatMap((f) => f.spaces).filter((s) => s.zone !== "circulation");
  const byName = rooms
    .filter((r) => t.includes(norm(r.name)))
    .sort((a, b) => b.name.length - a.name.length);
  if (byName[0]) return byName[0];
  for (const [kind, words] of Object.entries(KIND_WORDS)) {
    if (!words.some((w) => t.includes(norm(w)))) continue;
    const same = rooms.filter((r) => r.kind === kind || (kind === "office" && r.kind === "workspace") || (kind === "workspace" && r.kind === "office"));
    if (!same.length) continue;
    // "the bedroom", "main bedroom": the biggest one; "small bedroom": the smallest.
    const bySize = [...same].sort((a, b) => b.rect.w * b.rect.h - a.rect.w * a.rect.h);
    return / (small|smallest|chhota|chhoti) /.test(t) ? bySize.at(-1)! : bySize[0];
  }
  return null;
}

/** A kind of room to add, from the words: "a study" is an office, "pooja room" a prayer room. */
function kindIn(t: string): (typeof ADDABLE)[number] | null {
  for (const [kind, words] of Object.entries(KIND_WORDS)) {
    if (!words.some((w) => t.includes(norm(w)))) continue;
    const spec = ADDABLE.find((a) => a.kind === kind);
    if (spec) return spec;
  }
  return null;
}

export function understand(text: string, layout: Layout): Change | null {
  const t = norm(text);
  if (t.trim() === "") return null;

  const rename = text.match(/(?:rename|call)\s+(?:the\s+)?(.+?)\s+(?:to|as)\s+(.+)/i);
  if (rename) {
    const room = roomIn(rename[1], layout);
    if (room) return { op: "rename", room: room.id, name: rename[2].trim().replace(/[.!?]+$/, "") };
  }

  if (/ (kitchen|rasoi|किचन|रसोई) /.test(t)) {
    if (/ (open|khula|khuli|खुला|खुली) /.test(t) && !BIGGER.test(t) && !SMALLER.test(t)) return { op: "kitchen", open: true };
    if (/ (closed|close|separate|its own room|own room|alag|band|अलग|बंद) /.test(t)) return { op: "kitchen", open: false };
  }

  if (has(t, REMOVE)) {
    const room = roomIn(text, layout);
    if (room) return { op: "remove", room: room.id };
  }

  const growing = has(t, BIGGER);
  const shrinking = has(t, SMALLER);
  if (growing !== shrinking) {
    const room = roomIn(text, layout);
    if (room) {
      const by = growing ? 1.25 : 0.8;
      return { op: "resize", room: room.id, by: has(t, MUCH) ? by * by : by };
    }
  }

  if (has(t, ADD)) {
    const spec = kindIn(t);
    if (spec) return { op: "add", kind: spec.kind, name: spec.name };
  }
  return null;
}

/** Things to try, shown under the box: real rooms from this plan, so every one works. */
export function suggestions(layout: Layout): string[] {
  const rooms = layout.floors.flatMap((f) => f.spaces).filter((s) => s.zone !== "circulation");
  const home = ["house", "apartment", "studio"].includes(layout.spaceType);
  const kitchen = home || layout.spaceType === "cafe" ? rooms.find((r) => r.kind === "kitchen") : undefined;
  const biggest = [...rooms].sort((a, b) => b.rect.w * b.rect.h - a.rect.w * a.rect.h)[0];
  const out: string[] = [];
  if (kitchen) out.push(`Make the ${kitchen.name.toLowerCase()} bigger`);
  if (!home) out.push(rooms.some((r) => r.kind === "meeting") ? "Add a store room" : "Add a meeting room");
  else if (!rooms.some((r) => r.kind === "office")) out.push("Add a study");
  else if (!rooms.some((r) => r.kind === "guest-room")) out.push("Add a guest room");
  else out.push("Add a bathroom");
  if (kitchen) out.push(kitchen.open === false ? "Open up the kitchen" : "Give the kitchen its own room");
  if (biggest && biggest !== kitchen) out.push(`Make the ${biggest.name.toLowerCase()} smaller`);
  return out.slice(0, 4);
}
