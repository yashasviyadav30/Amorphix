// Creates a project as if its interview had just finished, then runs the real design pipeline on it.
// Prints the project id and a guest id that owns it. Run:
//   node --env-file=.env.local --env-file=.env scripts/seed-demo.ts
import { randomUUID } from "node:crypto";
import { homeBrands, search } from "../lib/qloo/api.ts";
import { buildProfile, layerOf } from "../lib/qloo/taste.ts";
import { createProject } from "../lib/project/store.ts";
import { designProject } from "../lib/design/run.ts";
import { chatModel } from "../lib/models.ts";

const guestId = randomUUID();
const loves = ["Ace Hotel New York", "Pottery Barn", "The Grand Budapest Hotel", "Norah Jones"];
const found = (await Promise.all(loves.map((n) => search(n, 1)))).map((r) => r[0]).filter(Boolean);
const signals = found.map((e) => ({ entityId: e.entity_id, name: e.name, layer: layerOf(e), type: e.types?.[0] }));
const liked = found.filter((e) => layerOf(e) !== 3).map((entity) => ({ entity, layer: layerOf(entity) as 1 | 2 }));
const taste = buildProfile(liked, await homeBrands(found.filter((e) => layerOf(e) === 3).map((e) => e.entity_id)));

const p = await createProject({
  guest_id: guestId,
  space_type: "house",
  title: "The Austin house",
  status: "designing",
  site: { width: 12.2, depth: 18.3, floors: 2, location: "Austin, TX", units: "imperial" },
  interview: {
    people: { adults: 2, kids: [6, 9], pets: "dog", worksFromHome: true },
    needs: { bedrooms: 3, office: true, dislikes: "dark kitchen" },
    budget: { range: "$450k to $550k" },
    // The demo persona's answers to "how do you live in it", as the interviewer would save them.
    living: { kitchen: "open", entertaining: "sometimes", bedrooms: "together", outlook: "garden", said: { kitchen: "I want to cook while the kids do homework" } },
  },
  taste_signals: signals,
  taste,
});
// With --fresh, stop here so the web app runs the design and shows the whole reveal.
if (process.argv.includes("--fresh")) {
  console.log(JSON.stringify({ projectId: p.id, guestId }));
} else {
  const t0 = Date.now();
  const d = await designProject(p.id, chatModel());
  console.log(JSON.stringify({ projectId: p.id, guestId, style: (d.brief as { name?: string })?.name, options: d.options?.length, ms: Date.now() - t0 }));
}
