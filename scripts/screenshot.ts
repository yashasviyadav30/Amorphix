// Screenshots a page in real Chrome, optionally as the guest who owns a project.
// Run: node --env-file=.env scripts/screenshot.ts <url> <out.png> [guestId] [width] [height] [waitMs]
import puppeteer from "puppeteer-core";
import { GUEST_COOKIE, signGuest } from "../lib/auth/guest.ts";

const [url, out, guestId, width = "1280", height = "900", waitMs = "1500"] = process.argv.slice(2);
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"];
const browser = await puppeteer.launch({ executablePath: chrome[0], headless: true, args: ["--force-color-profile=srgb", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.setViewport({ width: Number(width), height: Number(height) });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
if (guestId) {
  const { hostname } = new URL(url);
  await browser.setCookie({ name: GUEST_COOKIE, value: await signGuest(guestId, process.env.AMORPHIX_SESSION_SECRET!), domain: hostname, path: "/" });
}
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
await new Promise((r) => setTimeout(r, Number(waitMs)));
// CLICKS="selector||selector" clicks each in turn before the shot, e.g. to open a menu.
for (const sel of (process.env.CLICKS ?? "").split("||").filter(Boolean)) {
  await page.click(sel);
  await new Promise((r) => setTimeout(r, Number(process.env.CLICK_WAIT ?? 600)));
}
// AFTER_MS waits after the clicks, e.g. for a 3D scene to draw.
await new Promise((r) => setTimeout(r, Number(process.env.AFTER_MS ?? 0)));
// SHOTS="4000,12000" takes a series instead, each that many ms after the clicks: out-1.png, out-2.png...
const shots = (process.env.SHOTS ?? "").split(",").filter(Boolean).map(Number);
if (shots.length) {
  let waited = 0;
  for (const [i, at] of shots.entries()) {
    await new Promise((r) => setTimeout(r, at - waited));
    waited = at;
    await page.screenshot({ path: out.replace(/\.png$/, `-${i + 1}.png`), fullPage: false });
  }
} else await page.screenshot({ path: out, fullPage: !process.env.VIEWPORT_ONLY });
await browser.close();
console.log("saved", out);
console.log(errors.length ? ["page errors:", ...errors].join("\n") : "no page errors");
