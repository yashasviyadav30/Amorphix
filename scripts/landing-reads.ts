// Writes the landing page's taste band: a few pairs of things people love, each read by the same pipeline as the
// interview (descriptions, CLIP, the taste engine), with the style it names, its words and its nearest brands.
//   node --env-file=.env.local scripts/landing-reads.ts
import { writeFileSync } from "node:fs";
import { tasteFor } from "./taste-node.ts";
import { styleName } from "../lib/taste/name.ts";
import { cardWords } from "../lib/interview/logic.ts";
import { yb } from "../lib/taste/yb.ts";

const PAIRS: [string, string[]][] = [
  ["A home", ["The Grand Budapest Hotel", "Aman Tokyo"]],
  ["A café", ["Blue Bottle Coffee", "Norah Jones"]],
  ["A studio flat", ["Muji", "Spirited Away"]],
  ["An office", ["Ace Hotel New York", "Mad Men"]],
  ["A hotel lobby", ["Chateau Marmont", "Jonathan Adler"]],
];

const reads = [];
for (const [space, loves] of PAIRS) {
  const { taste } = await tasteFor(loves);
  reads.push({
    space,
    loves,
    style: styleName(taste),
    words: cardWords(taste, 4).map((w) => ({ word: w.word, from: w.from })),
    brands: taste.brands.slice(0, 2).map((b) => b.name),
  });
  console.log(space, "->", reads.at(-1)!.style, reads.at(-1)!.words.map((w) => w.word).join(", "), "|", reads.at(-1)!.brands.join(", "));
}
writeFileSync("lib/content/reads.json", JSON.stringify(reads, null, 2) + "\n");
await yb()?.end();
