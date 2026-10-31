import { test } from "node:test";
import assert from "node:assert/strict";
import { adjust, planOptionsFor, rank } from "./options.ts";
import { buildingShell } from "../layout/footprint.ts";
import { DEFAULT_SHELLS, TEMPLATES } from "../layout/templates.ts";
import { isOpen } from "../layout/walls.ts";
import { validate } from "../layout/validate.ts";
import { voiceProblems } from "../voice.ts";
import type { Profile } from "../qloo/taste.ts";

const house = TEMPLATES.house;
// Roomy enough that all four layout concepts fit, so the ranking alone decides which three show.
const shell = { width: 13, depth: 8.4 };
const tag = (value: string, weight: number, name: string) => ({ family: "ambience" as const, value, weight, sources: [{ entityId: name, name, layer: 1 as const }] });
const taste = (...tags: ReturnType<typeof tag>[]): Profile => ({ tags, brands: [] });
const ids = (who: Parameters<typeof planOptionsFor>[2]) => planOptionsFor(house, shell, who).map((l) => l.concept!.id);

test("a family that cooks together and hosts often gets the open great room first, in their own words", () => {
  const who = { interview: { living: { kitchen: "open", entertaining: "often", said: { kitchen: "I cook while the kids do homework" } }, people: { kids: [6, 9] } } };
  const plans = planOptionsFor(house, shell, who);
  assert.equal(plans[0].concept!.id, "great-room");
  const why = plans[0].concept!.why.join(" ");
  assert.match(why, /You said "I cook while the kids do homework"/);
  assert.match(why, /kids aged 6 and 9/);
});

test("parents who want the bedrooms apart, with guests staying over, get the split plan first", () => {
  const who = { interview: { living: { bedrooms: "apart", overnightGuests: true } } };
  assert.equal(ids(who)[0], "split");
});

test("a garden lover gets the garden-facing plan among the three", () => {
  assert.ok(ids({ interview: { living: { outlook: "garden" } } }).includes("hall-garden"));
  assert.equal(ids({ interview: { living: { outlook: "garden" } } })[0], "hall-garden");
});

test("Qloo taste moves the ranking and names the loved places", () => {
  const lively = rank({ taste: taste(tag("lively", 3, "Ace Hotel New York"), tag("social", 1, "Cafe Gratitude")) });
  assert.equal(lively[0].id, "great-room");
  assert.match(lively[0].why.join(" "), /Things you love, like Ace Hotel New York and Cafe Gratitude, lean lively and social/);
  const calm = rank({ taste: taste(tag("serene", 4, "Aman Tokyo")) });
  assert.equal(calm[0].id, "split");
  assert.match(calm[0].why.join(" "), /Aman Tokyo/);
});

test("a closed kitchen keeps its walls, and the hall plan comes first", () => {
  const plans = planOptionsFor(house, shell, { interview: { living: { kitchen: "closed" } } });
  assert.equal(plans[0].concept!.id, "hall-street");
  for (const l of plans) assert.equal(isOpen(l.floors[0].spaces.find((s) => s.kind === "kitchen")!), false, l.concept!.id);
});

test("clients at the home office put the office with the rooms by the front door", () => {
  const { program, why } = adjust(house, { interview: { living: { workVisitors: true } } });
  assert.equal(program.rooms.find((r) => r.kind === "office")!.zone, "public");
  assert.match(why[0], /office is near the front door/);
  const plans = planOptionsFor(house, shell, { interview: { living: { workVisitors: true } } });
  assert.ok(plans.every((l) => l.concept!.why.some((w) => /office/.test(w))));
});

test("with no answers there are still three different, valid plans, and no invented reasons", () => {
  const plans = planOptionsFor(house, shell, {});
  assert.equal(plans.length, 3);
  assert.equal(new Set(plans.map((l) => l.concept!.id)).size, 3);
  for (const l of plans) {
    assert.deepEqual(validate(l), []);
    assert.deepEqual(l.concept!.why, []);
    assert.ok(l.concept!.summary);
  }
});

test("cafes and offices get plan names for a business, not a home", () => {
  const cafe = TEMPLATES.cafe;
  const plans = planOptionsFor(cafe, buildingShell(cafe, DEFAULT_SHELLS.cafe), { space_type: "cafe" });
  assert.ok(plans.every((l) => !/bedroom|living/i.test(l.concept!.name + l.concept!.summary)));
});

test("every reason and summary follows the plain-English voice rules", () => {
  const who = {
    interview: { living: { kitchen: "open", entertaining: "often", bedrooms: "apart", overnightGuests: true, outlook: "garden", workVisitors: true }, people: { kids: [4, 14] } },
    taste: taste(tag("lively", 2, "A"), tag("serene", 2, "B"), tag("garden", 2, "C")),
  };
  for (const l of planOptionsFor(house, shell, who))
    for (const line of [l.concept!.summary!, ...l.concept!.why]) assert.deepEqual(voiceProblems(line), [], line);
});

test("odd interview data never breaks the ranking", () => {
  for (const interview of [null, {}, { living: "yes" }, { living: { kitchen: "sideways" } }, { people: { kids: "two" } }, { people: { kids: [null, "7"] } }])
    assert.equal(planOptionsFor(house, shell, { interview: interview as never }).length, 3);
});

test("a brand Qloo matched is never called something the user loves", () => {
  const matched = { family: "ambience" as const, value: "lively", weight: 3, sources: [{ entityId: "m", name: "Matched Brand", layer: 3 as const }] };
  const line = rank({ taste: { tags: [matched], brands: [] } }).find((r) => r.id === "great-room")!.why.join(" ");
  assert.match(line, /Brands that match the films and music you love, like Matched Brand/);
  assert.doesNotMatch(line, /Things you love, like Matched Brand/);
});

test("a café's reasons talk about guests, not living rooms or bedrooms", () => {
  const lively = { tags: [{ family: "ambience" as const, value: "lively", weight: 3, sources: [{ entityId: "a", name: "Cafe A", layer: 1 as const }] }], brands: [] };
  const why = rank({ space_type: "cafe", taste: lively }).flatMap((r) => r.why).join(" ");
  assert.match(why, /spaces guests use/);
  assert.doesNotMatch(why, /living|bedroom/i);
});
