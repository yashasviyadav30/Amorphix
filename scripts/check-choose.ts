// End-to-end check: choose a plan option on the Plans step, open the walkthrough, and screenshot the
// Explore inside mini-map, so we can see the 3D follows the chosen plan.
// Run: node --env-file=.env.local --env-file=.env scripts/check-choose.ts <projectUrl> <guestId> <option 1-3> <out.png>
import puppeteer from "puppeteer-core";
import { GUEST_COOKIE, signGuest } from "../lib/auth/guest.ts";

const [url, guestId, option, out] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.setViewport({ width: 1320, height: 800 });
await browser.setCookie({ name: GUEST_COOKIE, value: await signGuest(guestId, process.env.AMORPHIX_SESSION_SECRET!), domain: new URL(url).hostname, path: "/" });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
await page.goto(`${url}?step=plans&theme=light`, { waitUntil: "domcontentloaded" });
await wait(5000);
await page.click("::-p-text(Got it)").catch(() => {});
const buttons = await page.$$("article button");
await buttons[Number(option) - 1].click();
// FAST=1 clicks Next straight away, before the choice has saved.
await wait(process.env.FAST ? 50 : 4000);
console.log("buttons:", await Promise.all(buttons.map((b) => b.evaluate((e) => e.textContent))));
await page.click("::-p-text(Next: Walkthrough)");
await wait(4000);
// VIEW picks the mode to check: "Explore inside" (default), "Look around" or "Walk through".
const view = process.env.VIEW ?? "Explore inside";
if (view !== "Walk through") await page.click(`::-p-text(${view})`);
await wait(4000);
await page.click("::-p-text(Got it)").catch(() => {});
await wait(Number(process.env.AFTER_MS ?? 8000));
await page.screenshot({ path: out });
await browser.close();
console.log(errors.length ? errors.join("\n") : "no page errors");
