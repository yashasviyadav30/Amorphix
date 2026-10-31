// Live check of the taste engine against Qloo (through the cache). Prints a profile; writes nothing to the repo.
// Run: node --env-file=.env.local --env-file=.env scripts/taste-check.ts "Ace Hotel New York" "West Elm" ...
import { homeBrands, search } from "../lib/qloo/api.ts";
import { buildProfile, layerOf } from "../lib/qloo/taste.ts";

const names = process.argv.slice(2);
const t0 = Date.now();
const resolved = (await Promise.all(names.map((n) => search(n, 1)))).map((r) => r[0]).filter(Boolean);
const liked = resolved.filter((e) => layerOf(e) !== 3).map((entity) => ({ entity, layer: layerOf(entity) as 1 | 2 }));
const culture = resolved.filter((e) => layerOf(e) === 3).map((e) => e.entity_id);
const profile = buildProfile(liked, await homeBrands(culture));

console.log("resolved:", resolved.map((e) => `${e.name} [layer ${layerOf(e)}]`).join(", "));
console.log("style:", profile.tags.slice(0, 12).map((t) => `${t.family}:${t.value} ${t.weight.toFixed(1)}`).join(", "));
console.log("brands:", profile.brands.slice(0, 6).map((b) => `${b.name} (${b.aesthetic.slice(0, 3).join(", ")})`).join("; "));
console.log(`took ${Date.now() - t0} ms`);
