import { CONCEPT_IDS, placeConcept, type ConceptId, type Tweaks } from "../layout/concepts.ts";
import type { Layout, Program, Shell } from "../layout/schema.ts";
import { HOME_TYPES, livingOf, type Living } from "../interview/living.ts";
import { runningOf } from "../interview/running.ts";
import type { Profile } from "../qloo/taste.ts";

// The three plans a client sees: the layout concepts that fit how they live, best first, each with the reasons
// in their own words (from the interview) or their loves (from Qloo). Nothing in a reason is invented: a line
// appears only when an answer or a taste signal backs it.

export type Who = { interview?: Record<string, unknown> | null; taste?: Profile | null; space_type?: string | null };

const HOME_NAMES: Record<ConceptId, [name: string, summary: string]> = {
  "hall-street": ["Central hall, living to the street", "Every room opens off one hall: living rooms face the street, bedrooms face the back."],
  "hall-garden": ["Central hall, living to the garden", "Living rooms open onto the back garden; bedrooms sit quietly toward the street."],
  "great-room": ["Open great room", "Living, dining and kitchen share one bright open space, with the private rooms in their own wing."],
  split: ["Split plan", "An open living core in the middle, with bedrooms at opposite ends for privacy."],
};
const WORK_NAMES: Record<ConceptId, [name: string, summary: string]> = {
  "hall-street": ["Central corridor, guest spaces to the street", "A corridor down the middle; the spaces guests use face the street."],
  "hall-garden": ["Central corridor, guest spaces to the back", "A corridor down the middle; guest spaces sit at the quieter back."],
  "great-room": ["Open floor with a back-of-house wing", "One open floor for guests, with staff and service rooms in their own wing."],
  split: ["Open centre with wings at both ends", "An open centre for guests, with private and service rooms at either end."],
};

const SOCIAL = /lively|social|vibrant|bustl|energetic|buzz|festive|party|crowd|trendy|fun/;
const QUIET = /quiet|serene|calm|peaceful|intimate|relax|tranquil|secluded|romantic|cozy|cosy/;
const OUTDOOR = /garden|outdoor|patio|terrace|green|nature|courtyard|rooftop|botanical/;

/**
 * How strongly the Qloo taste leans one way, and who it comes from: things the user named (layers 1 and 2),
 * or, failing that, brands Qloo matched to the films and music they love (layer 3). The two are worded
 * differently so a matched brand is never passed off as something the user said they love.
 */
function lean(taste: Profile | null | undefined, re: RegExp) {
  const tags = (taste?.tags ?? []).filter((t) => re.test(t.value.replaceAll("_", " ")));
  const weight = tags.reduce((s, t) => s + t.weight, 0);
  const names = (pick: (layer: number) => boolean) => [...new Set(tags.flatMap((t) => t.sources.filter((s) => pick(s.layer)).map((s) => s.name)))].slice(0, 2);
  const loved = names((l) => l !== 3);
  const matched = names((l) => l === 3);
  const who = loved.length
    ? `Things you love, like ${list(loved)},`
    : matched.length
      ? `Brands that match the films and music you love, like ${list(matched)},`
      : "The things you love";
  return { weight, who };
}

/** The kids' ages from the interview, whatever shape the agent saved them in. */
function kidAges(interview: Record<string, unknown> | null | undefined): number[] {
  const people = (interview?.people ?? {}) as Record<string, unknown>;
  const kids = people.kids ?? people.children;
  if (Array.isArray(kids)) return kids.map(Number).filter((n) => Number.isFinite(n));
  return [];
}

const quoted = (said: string | undefined, fallback: string) => (said ? `You said "${said}"` : fallback);
const list = (names: string[]) => names.join(" and ");

type Scored = { id: ConceptId; score: number; why: string[] };

/** Scores every concept for this client and writes the reasons. Exported for tests. */
export function rank(who: Who): Scored[] {
  // Homes talk about living rooms and bedrooms; cafés, offices, shops and hotels about guest and private spaces.
  const home = !who.space_type || HOME_TYPES.has(who.space_type);
  const [openSpace, privateRooms, toGarden] = home
    ? ["the living spaces flow together", "the private rooms are tucked away", "living opens to the garden"]
    : ["the spaces guests use flow together", "the staff and private rooms are tucked away", "the guest spaces open to the back"];
  const living: Living = livingOf(who.interview);
  const said = living.said ?? {};
  const ages = kidAges(who.interview);
  const social = lean(who.taste, SOCIAL);
  const quiet = lean(who.taste, QUIET);
  const outdoor = lean(who.taste, OUTDOOR);
  const s: Record<ConceptId, Scored> = {
    "great-room": { id: "great-room", score: 0.3, why: [] },
    "hall-street": { id: "hall-street", score: 0.25, why: [] },
    split: { id: "split", score: 0.2, why: [] },
    "hall-garden": { id: "hall-garden", score: 0.1, why: [] },
  };
  const add = (id: ConceptId, points: number, line?: string) => {
    s[id].score += points;
    if (line && points > 0) s[id].why.push(line);
  };

  if (living.kitchen === "open") add("great-room", 3, `${quoted(said.kitchen, "You want to cook in the middle of things")}, so kitchen, dining and living are one open room.`);
  if (living.kitchen === "semi") add("great-room", 1.5, `${quoted(said.kitchen, "You like the kitchen half open")}, so it shares the living space without being on show.`);
  if (living.kitchen === "closed") {
    add("great-room", -2);
    add("hall-street", 1.5, `${quoted(said.kitchen, "You want a kitchen of its own")}, so the kitchen is a separate room off the hall.`);
  }
  if (living.entertaining === "often") {
    add("great-room", 2, `${quoted(said.entertaining, "You have people over often")}, so there's one big room to host in.`);
    add("hall-garden", 0.5, "Guests can spill out from the living room into the garden.");
  }
  if (living.entertaining === "sometimes") add("great-room", 1);
  if (ages.some((a) => a < 12)) add("great-room", 1, `With kids aged ${ages.filter((a) => a < 12).join(" and ")}, you can see them from the kitchen.`);

  if (living.bedrooms === "apart") add("split", 3, `${quoted(said.bedrooms, "You want the main bedroom apart from the others")}, so the bedrooms sit at opposite ends.`);
  if (living.bedrooms === "together") add("hall-street", 1, `${quoted(said.bedrooms, "You want the bedrooms close together")}, so they share one hall.`);
  if (living.overnightGuests) add("split", 1.5, `${quoted(said.overnightGuests, "Guests stay the night")}, and they get their own end of the house.`);
  if (ages.some((a) => a >= 13)) add("split", 1, "Teenagers get a little distance from the main bedroom.");

  if (living.outlook === "garden") add("hall-garden", 2.5, `${quoted(said.outlook, "You want the living room to face the garden")}, so it opens onto the back.`);
  if (living.outlook === "street") add("hall-street", 2, `${quoted(said.outlook, "You like the living room to face the street")}, so it sits at the front.`);

  // How a business runs: the café's service and kitchen, the office's way of working, the shop's display.
  const run = home ? {} : runningOf(who.interview);
  const rs = run.said ?? {};
  if (run.service === "takeaway") add("hall-street", 2.5, `${quoted(rs.service, "Most customers take away")}, so the counter faces the street and the queue never crosses the seats.`);
  if (run.service === "both") add("hall-street", 1, `${quoted(rs.service, "Some customers stay and some take away")}, so the counter sits by the door with the seats beyond it.`);
  if (run.service === "dine-in") add("great-room", 2.5, `${quoted(rs.service, "Most customers sit down")}, so the seating is one open room.`);
  if (run.kitchen === "full") add("split", 1.5, `${quoted(rs.kitchen, "You cook full meals")}, so the kitchen has its own end, with its heat and noise away from the seats.`);
  if (run.kitchen === "prep") add("great-room", 1, `${quoted(rs.kitchen, "You only make coffee and light food")}, so prep happens behind the counter in the main room.`);
  if (run.outdoor) add("hall-garden", 2.5, `${quoted(rs.outdoor, "You want seating outside")}, so the guest spaces open onto the back.`);
  if (run.work === "together") add("great-room", 3, `${quoted(rs.work, "Your team works together most of the day")}, so the workspace is one open floor.`);
  if (run.work === "focus") add("split", 3, `${quoted(rs.work, "Your team does focused work")}, so the desks and focus rooms sit in wings on either side, away from reception and the meeting room.`);
  if (run.work === "mixed") {
    add("split", 1.5, `${quoted(rs.work, "Your team works both alone and together")}, so there's an open middle and quiet ends.`);
    add("great-room", 1);
  }
  if (run.visitors) add("hall-street", 2, `${quoted(rs.visitors, "Clients come in")}, so reception and the meeting room are by the front door and visitors never walk through the team.`);
  if (run.display === "browse") add("great-room", 2.5, `${quoted(rs.display, "Customers like to wander and browse")}, so the shop floor is one open space.`);
  if (run.display === "showcase") add("hall-street", 2.5, `${quoted(rs.display, "You show a few pieces off")}, so the display faces the street window.`);

  if (social.weight > 0) add("great-room", Math.min(2, social.weight * 0.5), `${social.who} lean lively and social, so ${openSpace}.`);
  if (quiet.weight > 0) add("split", Math.min(2, quiet.weight * 0.5), `${quiet.who} lean calm and intimate, so ${privateRooms}.`);
  if (outdoor.weight > 0) add("hall-garden", Math.min(1.5, outdoor.weight * 0.5), `${outdoor.who} lean toward the outdoors, so ${toGarden}.`);

  return Object.values(s).sort((a, b) => b.score - a.score);
}

/** Room program changes the interview asks for: an office with clients goes with the rooms near the front door. */
export function adjust(program: Program, who: Who): { program: Program; tweaks: Tweaks; why: string[] } {
  const living = livingOf(who.interview);
  const why: string[] = [];
  let rooms = program.rooms;
  if (living.workVisitors && rooms.some((r) => r.kind === "office" && r.zone === "private")) {
    rooms = rooms.map((r) => (r.kind === "office" && r.zone === "private" ? { ...r, zone: "public" as const } : r));
    why.push(`${quoted(living.said?.workVisitors, "Clients come to your home office")}, so the office is near the front door, away from the bedrooms.`);
  }
  // Visitors to an office go to the meeting room, so it belongs with the rooms by the front door.
  const run = runningOf(who.interview);
  if (run.visitors && rooms.some((r) => r.kind === "meeting" && r.zone !== "public")) {
    rooms = rooms.map((r) => (r.kind === "meeting" ? { ...r, zone: "public" as const } : r));
    why.push(`${quoted(run.said?.visitors, "Clients come in")}, so the meeting room is near the front door.`);
  }
  return { program: { ...program, rooms }, tweaks: { closedKitchen: living.kitchen === "closed" }, why };
}

/**
 * Up to three plans for this client, best fit first, each a different concept with its name, summary and reasons.
 * Concepts that can't fit the site are skipped. Returns [] when nothing fits.
 */
export function planOptionsFor(program: Program, shell: Shell, who: Who = {}): Layout[] {
  const home = HOME_TYPES.has(who.space_type ?? program.spaceType);
  const names = home ? HOME_NAMES : WORK_NAMES;
  const { program: p, tweaks, why: shared } = adjust(program, who);
  const out: Layout[] = [];
  for (const { id, why } of rank({ ...who, space_type: who.space_type ?? program.spaceType })) {
    if (out.length === 3) break;
    const layout = placeConcept(p, shell, id, tweaks);
    if (!layout) continue;
    const [name, summary] = names[id];
    out.push({ ...layout, concept: { id, name, summary, why: [...why, ...shared] } });
  }
  return out;
}

export { CONCEPT_IDS };
