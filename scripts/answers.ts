// Prints a full, valid set of "Let's get to know you" answers for a space type, with real Qloo picks, for testing
// flows that need a finished interview. Run: node --env-file=.env.local --env-file=.env scripts/answers.ts house "Pune, India"
import { next, type Answers } from "../lib/interview/script.ts";
import { search } from "../lib/qloo/api.ts";
import { slotOf, matchesFor } from "../lib/plan-import/taste.ts";

const [type = "house", city = "Pune, India"] = process.argv.slice(2);
const LOVES: Record<string, string> = { place: "Ace Hotel New York", brand: "Pottery Barn", media: "Interstellar" };
const a: Answers = { type, city };
for (let q = next(a); q; q = next(a)) {
  if (q.kind === "choice") a[q.id] = q.choices![0].value;
  else if (q.kind === "multi") a[q.id] = [q.choices![0].value];
  else if (q.kind === "size") a[q.id] = { width: 40, depth: 60, unit: "ft" };
  else if (q.kind === "text") a[q.id] = q.optional ? "" : city;
  else if (q.optional) a[q.id] = "";
  else {
    const slot = slotOf(q.slot!)!;
    const hit = matchesFor(slot.id, LOVES[slot.id], await search(LOVES[slot.id], 10, slot.types.join(",")))[0];
    a[q.id] = { slot: q.slot!, id: hit.entityId, name: hit.name };
  }
}
console.log(JSON.stringify(a));
