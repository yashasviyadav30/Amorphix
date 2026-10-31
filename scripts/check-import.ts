// End-to-end check of "bring your own plan" in Chrome: upload a plan, check it, name a love, design, and
// screenshot each screen. Uses the real model (one read, one brief) and Qloo.
// Run: node --env-file=.env.local --env-file=.env scripts/check-import.ts <baseUrl> <plan.png> <outPrefix>
import puppeteer from "puppeteer-core";

const [base, file, out] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.setViewport({ width: 1300, height: 1000 });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
await page.goto(`${base}/start/plan?theme=light`, { waitUntil: "networkidle2" });
await page.click("::-p-text(Got it)").catch(() => {});
const input = await page.$("input[type=file]");
await (input as unknown as { uploadFile: (p: string) => Promise<void> }).uploadFile(file);
await page.select("select", "apartment");
await wait(500);
await page.screenshot({ path: `${out}-1-upload.png` });
await page.click("::-p-text(Read my plan)");
await page.waitForFunction(() => location.pathname.startsWith("/project/"), { timeout: 120_000 });
await page.waitForSelector("::-p-text(Is this your plan?)", { timeout: 60_000 }).catch(() => {});
await wait(2500);
await page.screenshot({ path: `${out}-2-check.png`, fullPage: true });
const loves = await page.$$("main input:not([aria-label])");
await loves[loves.length - 3].type("Ace Hotel New York");
await page.click("::-p-text(Design with my plan)");
await page.waitForSelector("::-p-text(Design my space)", { timeout: 120_000 });
await page.click("::-p-text(Design my space)");
await page.waitForSelector("::-p-text(Next: Plans)", { timeout: 240_000 });
await wait(2000);
await page.click("::-p-text(Next: Plans)");
await wait(3000);
await page.screenshot({ path: `${out}-3-plans.png`, fullPage: true });
console.log("project:", page.url());
await browser.close();
console.log(errors.length ? errors.join("\n") : "no page errors");
