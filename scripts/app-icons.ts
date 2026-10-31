// Makes the phone app's icons from Amorphix's logo on its navy square (scripts/assets/icon-boxed.svg): 192 and 512 for Android, a maskable 512 with room
// around the mark for round and squircle masks, and 180 for iPhone. Run: node scripts/app-icons.ts
import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync(new URL("./assets/icon-boxed.svg", import.meta.url));
const out = (name: string) => new URL(`../public/icons/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
for (const size of [192, 512]) await sharp(svg, { density: 600 }).resize(size, size).png().toFile(out(`icon-${size}.png`));
// Maskable: the mark at 70% on the full navy square, so no mask can clip it.
const mark = await sharp(svg, { density: 600 }).resize(358, 358).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#0e1a2b" } }).composite([{ input: mark, gravity: "center" }]).png().toFile(out("maskable-512.png"));
await sharp(svg, { density: 600 }).resize(180, 180).flatten({ background: "#0e1a2b" }).png().toFile(out("apple-180.png"));
console.log("icons made");
