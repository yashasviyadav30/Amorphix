import type { DemoRole } from "./story.ts";

// The demo accounts (made by scripts/demo-world.ts, which reuses them). Fixed here so proxy.ts can tell a demo
// session from a real one without a database call. Ids, not secrets.
export const DEMO_IDS: Record<DemoRole, string> = {
  maya: "c9ab99d3-4861-4e40-ab36-7ff20880f6ec",
  lena: "7f7e736f-0589-42fa-80b2-6a1adc1a01dd",
  mike: "e81f98fb-af22-4ce6-afa4-1c5504758d67",
  sam: "971431d2-d02d-44d2-9e0a-657be336995f",
};
const IDS = new Set(Object.values(DEMO_IDS));

/** The judge bar's cookie: "step.role". Not a session: the signed user cookie is. */
export const DEMO_COOKIE = "amorphix_demo";

/** Set when a judge leaves the tour to try Amorphix themselves: their own projects open in full without signing in. */
export const JUDGE_COOKIE = "amorphix_judge";

export const VIEW_ONLY = "This is the judges' demo, so it's view only. Sign up free to try it on your own project.";

// What a demo session may still send: the interview's live taste card, and signing out.
const OPEN = [
  { method: "POST", path: "/api/taste/describe" },
  { method: "POST", path: "/api/taste/profile" },
  { method: "DELETE", path: "/api/session" },
];

/** Whether a request from this user must be refused: anything but reading, for a demo account. */
export function refuseDemo(userId: string | null, method: string, path: string): boolean {
  if (!userId || !IDS.has(userId) || method === "GET" || method === "HEAD") return false;
  return !OPEN.some((o) => o.method === method && path === o.path);
}
