// Pictures of a project's 3D for checking it by eye: the walk through its rooms, then the house from outside.
// Run with the app up: node --env-file=.env.local --env-file=.env scripts/shots-3d.ts <projectId> <out dir> [base] [demo role]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { signUser } from "../lib/auth/guest.ts";
import { DEMO_IDS } from "../lib/demo/ids.ts";
import type { DemoRole } from "../lib/demo/story.ts";

const [id, out, base = "http://localhost:3001", role = "maya"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--force-color-profile=srgb", "--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--window-size=1600,1000"] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
page.on("pageerror", (e) => console.log("PAGE ERROR", String(e).slice(0, 300)));
page.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text().slice(0, 300)));
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
await browser.setCookie({ name: "amorphix_user", value: await signUser(DEMO_IDS[role as DemoRole], process.env.AMORPHIX_SESSION_SECRET!), domain: new URL(base).hostname, path: "/" });
const wait = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
await page.goto(`${base}/project/${id}?step=walkthrough${process.env.EXTRA ?? ""}`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  try {
    localStorage.setItem("amorphix_cookie_notice", "seen");
    sessionStorage.setItem("amorphix-intro", "1");
  } catch {}
});
await page.waitForSelector("canvas", { timeout: 90_000 });
await wait(6);
// the 3D's canvas is made again when the view changes, so find it each time
const canvasNow = async () => (await page.$$("canvas")).at(-1)!;
const shot = async (name: string) => {
  const c = await canvasNow();
  await c.scrollIntoView();
  await wait(2); // a view scrolled out of sight stops drawing; give it a moment to start again
  await c.screenshot({ path: join(out, `${name}.png`) });
  console.log(name);
};
const click = async (text: string) => {
  const ok = await page.evaluate((t) => {
    const b = [...document.querySelectorAll("button,[role=radio]")].find((x) => x.textContent?.trim() === t) as HTMLElement | undefined;
    b?.click();
    return !!b;
  }, text);
  if (!ok) console.log(`no button "${text}"`);
  await wait(3);
};
// the walk plays by itself through the rooms (WALK=0 skips it)
for (let i = 0; i < (process.env.WALK === "0" ? 0 : 16); i++) {
  await shot(`walk-${String(i).padStart(2, "0")}`);
  await wait(3);
}
await click("Look around");
await click("Got it");
await shot("floor-ground");
await click("Upstairs");
await shot("floor-upstairs");
await click("All floors");
await shot("floor-all");
// the roof back on: the house from outside
await click("Showing inside");
await shot("outside");
await click("Whole house");
await shot("outside-whole");
// turn the house round, a quarter at a time, to see every side
for (let i = 1; i <= 3; i++) {
  const box = (await (await canvasNow()).boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6, { steps: 20 });
  await page.mouse.up();
  await wait(2);
  await shot(`outside-turn${i}`);
}
await click("Day");
await wait(2);
await shot("outside-night");
await browser.close();
