import { test } from "node:test";
import assert from "node:assert/strict";
import { asked, labelOf, matchChoices, next, picksOf, problems, QUESTIONS, toProject, usesFeet, type Answers } from "./script.ts";
import { missingForDesign } from "./logic.ts";
import { livingOf, Living } from "./living.ts";
import { runningOf } from "./running.ts";
import type { Project } from "../project/store.ts";

// Answers a script the way a person tapping the first choice would, with a size, a city and three taste picks.
function walk(type: string, over: Answers = {}): Answers {
  const a: Answers = { type, ...over };
  for (let q = next(a); q; q = next(a)) {
    if (q.kind === "choice") a[q.id] = q.choices![0].value;
    else if (q.kind === "multi") a[q.id] = [q.choices![0].value];
    else if (q.kind === "size") a[q.id] = { width: 40, depth: 60, unit: "ft" };
    else if (q.kind === "text") a[q.id] = q.optional ? "" : "Pune, India";
    else a[q.id] = q.optional ? "" : { slot: q.slot!, id: `id-${q.id}`, name: `A ${q.slot}` };
  }
  return a;
}

const asProject = (a: Answers): Project => {
  const p = toProject(a, "en");
  return {
    id: "p", owner_id: null, guest_id: "g", mode: "owner", status: "designing", brief: null, program: null, chosen_option: null, taste: null,
    ...p,
    taste_signals: picksOf(a).map((t) => ({ entityId: t.id, name: t.name, layer: t.slot === "media" ? 3 : 1 })),
  };
};

for (const type of ["house", "apartment", "studio", "cafe", "office", "shop", "hotel"]) {
  test(`a full ${type} interview is ready to design`, () => {
    const a = walk(type);
    assert.deepEqual(problems(a), []);
    assert.equal(next(a), null);
    assert.deepEqual(missingForDesign(asProject(a)), []);
  });
}

test("a home saves what the plan ranking reads", () => {
  const a = walk("house", { who: ["me", "partner", "kids", "pets"], kids: ["3", "15"], wfh: "yes", bedrooms: "3", bedroomsPlace: "apart", kitchen: "open", dislikes: "  the kitchen is too dark " });
  const p = toProject(a, "en");
  const people = p.interview.people as Record<string, unknown>;
  assert.deepEqual(people.kids, [3, 15]);
  assert.equal(people.adults, 2);
  assert.equal(people.pets, true);
  assert.equal(people.worksFromHome, true);
  const living = livingOf(p.interview);
  assert.equal(Living.safeParse(p.interview.living).success, true);
  assert.equal(living.kitchen, "open");
  assert.equal(living.bedrooms, "apart");
  assert.equal(living.workVisitors, true); // asked because they work from home
  assert.deepEqual(p.interview.dislikes, { said: "the kitchen is too dark" });
  assert.equal((p.interview.needs as { bedrooms: number }).bedrooms, 3);
  // Chip labels never become quotes: "You said ..." only quotes what someone typed.
  assert.equal(living.said, undefined);
});

test("questions follow the answers: kids' ages only with kids, visitors only when working from home", () => {
  const ids = (a: Answers) => asked(a).map((q) => q.id);
  assert.ok(!ids(walk("house", { who: ["me"] })).includes("kids"));
  assert.ok(ids(walk("house", { who: ["kids"] })).includes("kids"));
  assert.ok(!ids(walk("house", { wfh: "no" })).includes("workVisitors"));
  assert.ok(!ids(walk("apartment", { bedrooms: "1" })).includes("bedroomsPlace"));
  assert.equal(livingOf(toProject(walk("apartment", { bedrooms: "1" }), "en").interview).bedrooms, "together");
  assert.ok(!ids(walk("cafe")).includes("who"));
  assert.ok(!ids(walk("office")).includes("guests"));
  assert.ok(ids(walk("house")).includes("floors") && !ids(walk("apartment")).includes("floors"));
});

test("a business saves how it runs, with numbers", () => {
  assert.deepEqual(runningOf(toProject(walk("cafe", { seats: "45", service: "takeaway" }), "en").interview), { service: "takeaway", kitchen: "full", seats: 45, outdoor: true });
  assert.equal(runningOf(toProject(walk("office", { people: "18" }), "en").interview).people, 18);
  assert.equal(runningOf(toProject(walk("shop", { fittingRooms: "0" }), "en").interview).fittingRooms, 0);
  assert.equal(runningOf(toProject(walk("hotel", { rooms: "20" }), "en").interview).rooms, 20);
});

test("the site is saved in metres, with a typical size when they aren't sure", () => {
  const ft = toProject(walk("house", { size: { width: 40, depth: 60, unit: "ft" }, floors: "2" }), "en").site;
  assert.deepEqual([ft.width, ft.depth, ft.floors, ft.units], [12.19, 18.29, 2, "imperial"]);
  const typical = toProject(walk("cafe", { size: { typical: true } }), "en").site;
  assert.deepEqual([typical.width, typical.depth, typical.floors, typical.units], [12, 9, 1, "metric"]);
  assert.equal(toProject(walk("house", { city: "Austin, TX" }), "en").title, "The Austin house");
});

test("answers the browser made up are refused", () => {
  const a = walk("house");
  assert.match(problems({ ...a, kitchen: "rooftop" }).join(), /bad choice: kitchen/);
  assert.match(problems({ ...a, who: [] }).join(), /bad choices: who/);
  assert.match(problems({ ...a, who: ["me", "robot"] }).join(), /bad choices: who/);
  assert.match(problems({ ...a, size: { width: 4000, depth: 60, unit: "ft" } }).join(), /outside 6 to 180 metres/);
  assert.match(problems({ ...a, city: " " }).join(), /bad text: city/);
  assert.match(problems({ ...a, place: { slot: "brand", id: "x", name: "x" } }).join(), /bad pick: place/);
  const { budget: _, ...noBudget } = a;
  assert.match(problems(noBudget).join(), /unanswered: budget/);
});

test("every question and choice reads in all three languages", () => {
  for (const q of QUESTIONS) {
    for (const lang of ["en", "hi", "hinglish"] as const) {
      assert.ok(q.ask[lang].trim(), `${q.id} ask ${lang}`);
      for (const ch of q.choices ?? []) assert.ok(ch.label[lang].trim(), `${q.id}.${ch.value} ${lang}`);
    }
    // Choice values are what gets saved, so they must be unique within a question.
    const values = (q.choices ?? []).map((ch) => ch.value);
    assert.equal(new Set(values).size, values.length, q.id);
  }
  const who = QUESTIONS.find((q) => q.id === "who")!;
  assert.equal(labelOf(who, ["me", "pets"], "hinglish"), "Main, Pets");
});

test("typed or spoken answers pick choices in any language", () => {
  const q = (id: string) => QUESTIONS.find((x) => x.id === id)!;
  assert.deepEqual(matchChoices("haan", q("wfh")), ["yes"]);
  assert.deepEqual(matchChoices("Yes, I do", q("wfh")), ["yes"]);
  assert.deepEqual(matchChoices("नहीं", q("wfh")), ["no"]);
  assert.deepEqual(matchChoices("a cafe", q("type")), ["cafe"]);
  assert.deepEqual(matchChoices("it's an apartment in Pune", q("type")), ["apartment"]);
  assert.deepEqual(matchChoices("me, my partner and the kids", q("who")), ["me", "partner", "kids"]);
  assert.deepEqual(matchChoices("about 40 seats", q("seats")), ["45"]);
  assert.deepEqual(matchChoices("3", q("bedrooms")), ["3"]);
  assert.deepEqual(matchChoices("something else entirely", q("kitchen")), []);
});

test("the style is three picks after the interview's questions: a place, a brand, a film or music", () => {
  const all = walk("house");
  assert.deepEqual(picksOf(all).map((p) => p.id), ["id-place", "id-brand", "id-media"]);
  assert.deepEqual(problems(all), []);
  // A taste pick can't be skipped.
  assert.match(problems({ ...all, brand: "" }).join(), /bad pick: brand/);
  // Every other question, budget included, comes before the first pick.
  const order = QUESTIONS.map((q) => q.id);
  assert.ok(QUESTIONS.filter((q) => q.kind !== "taste").every((q) => order.indexOf(q.id) < order.indexOf("place")));
  assert.match(QUESTIONS.find((q) => q.id === "place")!.lead!.en, /find your style/);
});

test("a typical size takes its units from the city: feet in the US, metres elsewhere", () => {
  for (const c of ["Austin, TX", "Brooklyn", "Los Angeles", "Portland, OR", "Boston, USA"]) assert.equal(usesFeet(c), true, c);
  for (const c of ["Pune", "London, UK", "Paris, France", "Toronto, ON", "Mumbai, India"]) assert.equal(usesFeet(c), false, c);
});
