// Records the footage for the submission film from the live site: the judges' tour and a test owner's own project,
// as a person would use them (a visible cursor that moves, clicks and types), one clip per beat, at 1920x1080.
// The tour's pill and quick guide are hidden; everything else is the real app.
//   FFMPEG_PATH=<ffmpeg.exe> node --env-file=.env.local --env-file=.env scripts/record-submission.ts <out dir> [beat ...]
// The clips show Amorphix images, so they stay out of the repo.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import puppeteer, { type Page } from "puppeteer-core";
import { signUser } from "../lib/auth/guest.ts";

const [out = "film", ...only] = process.argv.slice(2);
const BASE = process.env.FILM_BASE ?? "https://amorphix.vercel.app";
const HOST = new URL(BASE).hostname;
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const EDIT_PROJECT = "ab285435-ac14-4fab-9a02-2659470050f0"; // the test owner's Los Angeles house, unlocked, in design
mkdirSync(out, { recursive: true });

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data } = await db.auth.admin.listUsers({ perPage: 200 });
const owner = data.users.find((x) => x.email === "amorphix.test.owner@example.com");
if (!owner) throw new Error("no test owner");
const ownerCookie = await signUser(owner.id, process.env.AMORPHIX_SESSION_SECRET!);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb", "--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--window-size=1280,720", "--autoplay-policy=no-user-gesture-required"] });
const page: Page = await browser.newPage();
// a laptop-sized page at 1.5x, so the film is 1920x1080 with text large enough to read
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1.5 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);

// On every page: no tour pill, no quick guide, no cookie notice, and a cursor that follows the mouse.
await page.evaluateOnNewDocument(() => {
  try {
    sessionStorage.setItem("amorphix-guide-tour-start", "1");
    sessionStorage.setItem("amorphix-guide-tour-app", "1");
    localStorage.setItem("amorphix-guide-start", "1");
    localStorage.setItem("amorphix-guide-project", "1");
    localStorage.setItem("amorphix_cookie_notice", "seen");
  } catch {}
  const style = document.createElement("style");
  style.textContent = `#judge-pill, nav[aria-label="Judges' tour"], div:has(> [aria-label="How to explore"]) { display: none !important } body { padding-bottom: 0 !important }
    #film-cursor { position: fixed; z-index: 2147483647; width: 26px; height: 26px; pointer-events: none; transform: translate(-3px, -2px); transition: transform .08s }
    #film-cursor.down { transform: translate(-3px, -2px) scale(.86) }`;
  const add = () => {
    document.head.appendChild(style);
    const c = document.createElement("div");
    c.id = "film-cursor";
    c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 9-6.5 1.6L9.5 19z" fill="#0e1a2b" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    c.style.left = "-100px";
    c.style.top = "-100px";
    document.body.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => c.classList.add("down"), true);
    addEventListener("mouseup", () => c.classList.remove("down"), true);
  };
  if (document.body) add();
  else addEventListener("DOMContentLoaded", add);
});

const wait = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
let mouse = { x: 640, y: 360 };
async function glide(x: number, y: number, ms = 700) {
  const steps = Math.max(8, Math.round(ms / 16));
  await page.mouse.move(x, y, { steps });
  mouse = { x, y };
}
/** Move to the element matching `sel` (and holding `text`, if given), then click it. */
async function clickOn(sel: string, text?: string, ms = 700) {
  const handle = await page.evaluateHandle(
    (s, t) => [...document.querySelectorAll<HTMLElement>(s)].find((e) => e.getBoundingClientRect().width > 0 && (!t || (e.textContent ?? "").trim().includes(t))) ?? null,
    sel,
    text ?? "",
  );
  const el = handle.asElement();
  if (!el) throw new Error(`nothing to click: ${sel} ${text ?? ""}`);
  await (el as unknown as { scrollIntoViewIfNeeded(): Promise<void> }).scrollIntoViewIfNeeded();
  const box = await el.boundingBox();
  if (!box) throw new Error(`no box: ${sel}`);
  await glide(box.x + box.width / 2, box.y + box.height / 2, ms);
  await wait(0.15);
  await page.mouse.down();
  await wait(0.08);
  await page.mouse.up();
}
/** Scroll smoothly by `dy` pixels over `s` seconds. */
async function scroll(dy: number, s: number, steps = Math.round(s * 30)) {
  // over a 3D canvas every wheel event redraws the scene, so zooms there use a few big steps
  const n = steps;
  for (let i = 0; i < n; i++) {
    await page.mouse.wheel({ deltaY: dy / n });
    await wait(1 / 30);
  }
}
async function until(text: string, timeout = 60) {
  await page.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout: timeout * 1000 }, text);
}
async function go(path: string, text: string, settle = 1.5) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await until(text, 90);
  await page.waitForFunction(() => !document.documentElement.dataset.veil && !document.querySelector("[data-page-loading]"), { timeout: 30000 });
  await wait(settle);
}

const want = (name: string) => !only.length || only.includes(name);
async function beat(name: string, act: () => Promise<void>) {
  if (!want(name)) return;
  const file = join(out, `${name}.webm`) as `${string}.webm`;
  const rec = await page.screencast({ path: file, ffmpegPath: FFMPEG, fps: 30, scale: 1.5 });
  await act();
  await rec.stop();
  console.log("recorded", name);
}

// 1. the opening: Amorphix's mark grows, the name resolves (the landing page's own intro)
if (want("opening")) {
  await page.deleteCookie({ name: "amorphix_demo", domain: HOST }, { name: "amorphix_user", domain: HOST });
  await page.goto(BASE + "/?site", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => sessionStorage.removeItem("amorphix-intro"));
  await page.goto(BASE + "/?site", { waitUntil: "networkidle2" });
  await wait(1);
  await beat("opening", async () => {
    await page.mouse.click(640, 360);
    await wait(5);
  });
}

// 2. the hero film: a house drawn as a sketch, then in colour, then at night (the "same box" and the turn)
await beat("hero", async () => {
  await page.goto(BASE + "/?site", { waitUntil: "networkidle2" });
  await wait(14);
});

// 3. Maya's interview: her answers and her three picks, read by Amorphix, then the reveal
await beat("interview", async () => {
  await page.goto(BASE + "/demo?step=1", { waitUntil: "domcontentloaded" });
  await until("what are we designing", 60);
  // through the replay at 2x until it moves on to her style (about 40 s)
  await page.waitForFunction(() => location.pathname.startsWith("/project/"), { timeout: 120000, polling: 500 }).catch(() => {});
  await wait(1);
});

// 4. her style: the words and their sources, the moodboard, art and the playlist
await beat("style", async () => {
  await go("/demo?step=2", "classic hollywood", 1.2);
  await glide(467, 320, 900);
  await scroll(520, 3.5);
  await wait(1.5);
  await scroll(900, 4.5);
  await wait(1.2);
  await scroll(1500, 5);
  await wait(2);
});

// 5. the three plans and their reasons
await beat("plans", async () => {
  await go("/demo?step=3", "plans picked for how you live", 1);
  await glide(373, 413, 900);
  await scroll(420, 3);
  await wait(3);
});

// 6. the 3D walk, then Look around
if (want("walk")) await go("/demo?step=4", "walk through", 7);
await beat("walk", async () => {
  await wait(9);
  await clickOn("button", "Look around", 900);
  await wait(6);
});

// 7. the budget, then the shopping list
await beat("budget", async () => {
  await go("/demo?step=5", "by trade", 1);
  await glide(507, 307, 700);
  await scroll(700, 3.5);
  await wait(1);
});
await beat("shop", async () => {
  await go("/demo?step=6", "shopping list", 1.2);
  await glide(507, 347, 700);
  await scroll(800, 4);
  await wait(1);
});

// 8. a change by asking, on a test owner's own design (undone afterwards)
if (want("change")) {
  await page.deleteCookie({ name: "amorphix_demo", domain: HOST });
  await page.setCookie({ name: "amorphix_user", value: ownerCookie, domain: HOST, path: "/", secure: true, httpOnly: true });
  await beat("change", async () => {
    await go(`/project/${EDIT_PROJECT}?step=workspace`, "make it yours", 2);
    await clickOn('input[aria-label="What to change"], input[placeholder*="Tell Amorphix"]', undefined, 900);
    await page.keyboard.type("add a study", { delay: 70 });
    await wait(0.4);
    await page.keyboard.press("Enter");
    await wait(5);
  });
  await page.evaluate((id) => fetch(`/api/projects/${id}/edit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ undo: true }) }), EDIT_PROJECT);
  await page.deleteCookie({ name: "amorphix_user", domain: HOST });
}

// 9. the team: the screen between stops says whose view, Lena's studio, Mike's site, Ana's keys
await beat("team", async () => {
  await go("/demo?step=7", "take your design with you", 1);
  await page.evaluate(() => [...document.querySelectorAll<HTMLAnchorElement>("a[href='/demo?step=8']")][0]?.click());
  await until("studio", 60);
  await wait(4.5);
  await glide(600, 347, 800);
  await scroll(500, 2.5);
  await wait(1);
  await go("/demo?step=9", "kitchen, bathrooms", 0.5);
  await wait(4);
  await go("/demo?step=10", "ana", 0.5);
  await glide(600, 400, 800);
  await scroll(700, 3);
  await wait(1.5);
});

// 10. the café: Amorphix reads its street, then by night
await beat("cafe", async () => {
  await go("/demo?step=11", "your neighbourhood", 2.5);
  await clickOn("button", "Under 25", 900);
  await wait(3);
});

// the café by night: recorded from the page opening, long enough for the 3D to load, show the sign, then open inside
await beat("cafe3d", async () => {
  await go("/demo?step=12", "look around", 0.5);
  // wait for the 3D, then move in close: the lit sign by night, then inside once it opens up
  await page.waitForFunction(() => !!document.querySelector("canvas"), { timeout: 60000 });
  await wait(9);
  const box = await (await page.$("canvas"))?.boundingBox();
  if (box) await glide(box.x + box.width / 2, box.y + box.height / 2, 900);
  await scroll(-900, 3, 8);
  await wait(6);
  await scroll(-500, 2.5, 6);
  await wait(9);
});

// 11. the close: Maya's house at dusk from the street
if (want("close")) {
  await go("/demo?step=4", "walk through", 5);
  await clickOn("button", "Look around", 300);
  await wait(4);
}
await beat("close", async () => {
  await wait(2);
  await clickOn("button", "Day", 900);
  await wait(9);
});

await browser.close();
