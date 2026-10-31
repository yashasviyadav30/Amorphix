import type { Profile, StyleTag } from "../qloo/taste.ts";
import { isComplaint } from "../qloo/words.ts";
import type { TasteSignal } from "../project/store.ts";
import type { Layout } from "../layout/schema.ts";
import type { Brief } from "./brief.ts";
import { kindOf } from "../interview/logic.ts";

// The taste trail: every design choice next to the Qloo signal behind it. Things the user named are "loved";
// brands Qloo matched to them are "matched", and always say what they were matched to, so a matched brand is
// never passed off as something the user said.

type Taste = { taste_signals: TasteSignal[]; taste: Profile | null };

/** Who a choice is credited to: a thing they love, or a brand matched to the things they love. */
export type Credit = { name: string; loved: boolean; via: string[] };

const label = (w: string) => w.replaceAll("_", " ");

/** How to credit a name: loved if they named it, else the loved things Qloo matched it to, strongest first. */
export function creditOf(p: Taste, name: string): Credit {
  if (p.taste_signals.some((s) => s.name === name)) return { name, loved: true, via: [] };
  const brand = p.taste?.brands.find((b) => b.name === name);
  const named = new Map(p.taste_signals.map((s) => [s.entityId, s.name]));
  const via = (brand?.because ?? [])
    .filter((b) => named.has(b.entityId))
    .sort((a, b) => b.score - a.score)
    .map((b) => named.get(b.entityId)!);
  return { name, loved: false, via: [...new Set(via)] };
}

/** "Ace Hotel New York", or "Buster + Punch, matched to Interstellar". */
export function sayCredit(c: Credit): string {
  return c.loved || !c.via.length ? c.name : `${c.name}, matched to ${c.via.slice(0, 2).join(" and ")}`;
}

const STYLE_FAMILIES = new Set(["decor", "ambience", "aesthetic", "style"]);

/**
 * The words their style is made of: the strongest decor, ambience and aesthetic tags, each with where it came
 * from. A word backed by something they named comes before one only matched brands carry.
 */
export function styleWords(p: Taste, n = 6): { word: string; from: Credit[] }[] {
  const tags = (p.taste?.tags ?? []).filter((t) => STYLE_FAMILIES.has(t.family) && !isComplaint(t.value));
  const loved = (t: StyleTag) => t.sources.some((s) => s.layer !== 3);
  // Take turns between the things they named, strongest word first from each, so one hotel can't fill the list.
  const lead = (t: StyleTag) => t.sources.find((s) => s.layer !== 3)!.entityId;
  const queues = new Map<string, StyleTag[]>();
  for (const t of tags.filter(loved)) queues.set(lead(t), [...(queues.get(lead(t)) ?? []), t]);
  const turns: StyleTag[] = [];
  for (let i = 0; [...queues.values()].some((q) => q.length > i); i++) for (const q of queues.values()) if (q[i]) turns.push(q[i]);
  const seen = new Set<string>();
  return [...turns, ...tags.filter((t) => !loved(t))]
    .filter((t) => !seen.has(label(t.value)) && seen.add(label(t.value)))
    .slice(0, n)
    .map((t) => ({ word: label(t.value), from: t.sources.map((s) => creditOf(p, s.name)).sort((a, b) => Number(b.loved) - Number(a.loved)) }));
}

/** The style words a style name is built from ("Industrial Bohemian" -> industrial, bohemian), if any. */
export function nameWords(name: string, words: { word: string; from: Credit[] }[]) {
  const parts = name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  // The same word give or take an ending: "moody" and "moodily", "industrial" and "industrials".
  const same = (a: string, b: string) => {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return i >= 4 && i >= Math.min(a.length, b.length) * 0.75;
  };
  return words.filter((w) => w.word.split(" ").some((x) => parts.some((p) => same(x, p))));
}

export type Trail = {
  loves: { name: string; kind: string; gave: string[]; led: { name: string; strength: number }[] }[];
  matched: { name: string; look: string[]; to: { name: string; strength: number }[] }[];
  choices: { what: string; choice: string; from: Credit[] }[];
};

/** Everything the taste decided, with the evidence: what each loved thing gave, and where each choice came from. */
export function tasteTrail(p: Taste, brief: Brief | null, chosen?: Layout | null): Trail {
  const tags = p.taste?.tags ?? [];
  const brands = p.taste?.brands ?? [];
  const loves = p.taste_signals.map((s) => ({
    name: s.name,
    kind: s.layer === 1 ? "place" : s.layer === 2 ? "brand" : kindOf(s.type),
    gave: tags.filter((t) => STYLE_FAMILIES.has(t.family) && t.sources.some((x) => x.entityId === s.entityId)).slice(0, 5).map((t) => label(t.value)),
    led: brands
      .map((b) => ({ name: b.name, strength: b.because.find((x) => x.entityId === s.entityId)?.score ?? 0 }))
      .filter((b) => b.strength > 0)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 4),
  }));
  const named = new Map(p.taste_signals.map((s) => [s.entityId, s.name]));
  const matched = brands.slice(0, 8).map((b) => ({
    name: b.name,
    look: b.aesthetic.slice(0, 4).map(label),
    to: b.because.filter((x) => named.has(x.entityId)).sort((a, c) => c.score - a.score).map((x) => ({ name: named.get(x.entityId)!, strength: x.score })),
  }));

  const choices: Trail["choices"] = [];
  const credit = (names: string[]) => names.map((n) => creditOf(p, n));
  const words = styleWords(p, 10);
  if (brief) {
    const behind = nameWords(brief.name, words);
    const from = (behind.length ? behind : words.slice(0, 2)).flatMap((w) => w.from);
    choices.push({ what: "Style", choice: brief.name, from: [...new Map(from.map((c) => [c.name, c])).values()].slice(0, 3) });
    for (const c of brief.palette) choices.push({ what: `Colour (${c.role})`, choice: c.name, from: credit(c.from) });
    for (const m of brief.materials) choices.push({ what: "Material", choice: `${m.name}, ${m.where}`, from: credit(m.from) });
    choices.push({ what: "Light", choice: brief.lighting.mood, from: credit(brief.lighting.from) });
  }
  // The chosen plan's reasons that come from taste (the rest quote the interview).
  const sources = [...p.taste_signals.map((s) => s.name), ...brands.map((b) => b.name)];
  for (const why of chosen?.concept?.why ?? []) {
    const from = sources.filter((n) => why.includes(n));
    if (from.length) choices.push({ what: "Plan", choice: why, from: credit(from) });
  }
  return { loves, matched, choices: choices.filter((c) => c.from.length) };
}
