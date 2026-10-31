// Live smoke test: behaves like a browser against a deployed Amorphix.
// Gets a guest cookie from the home page, then holds a short conversation with the interviewer.
// Run: node scripts/smoke-interview.ts https://amorphix.vercel.app "first message" ["second message" ...]
import { Client } from "eve/client";

const [base = "https://amorphix.vercel.app", ...turns] = process.argv.slice(2);
const home = await fetch(base, { redirect: "manual" });
const cookie = (home.headers.get("set-cookie") ?? "").split(";")[0];
if (!cookie.startsWith("amorphix_guest=")) throw new Error(`no guest cookie from ${base} (status ${home.status})`);

const client = new Client({ host: `${base}/eve/interviewer`, headers: { cookie } });
const messages = turns.length ? turns : ["I'm designing a new two-storey house in Austin, Texas. The plot is 40 by 60 feet."];

type Event = { type: string; data?: Record<string, unknown> };
type Result = { status: string; message?: string; events: Event[] };

function show(r: Result, i: number) {
  const tools = r.events.filter((e) => e.type.startsWith("action.") && e.data?.toolName).map((e) => `${e.type}:${e.data?.toolName}`);
  const failed = r.events.filter((e) => /failed|error/.test(e.type));
  console.log(`\n--- turn ${i + 1}: ${r.status}`);
  console.log("event types:", [...new Set(r.events.map((e) => e.type))].join(", "));
  if (tools.length) console.log("tools:", [...new Set(tools)].join(", "));
  if (failed.length) console.log("failures:", JSON.stringify(failed).slice(0, 800));
  console.log("reply:", r.message ?? "(none)");
}

const { session, response } = await client.sessions.create({ message: messages[0] });
console.log("session", response.sessionId);
show((await response.result()) as unknown as Result, 0);
for (let i = 1; i < messages.length; i++) {
  const next = (await session.send(messages[i])) as unknown as { result?: () => Promise<Result> } & Result;
  show(typeof next.result === "function" ? await next.result() : next, i);
}
