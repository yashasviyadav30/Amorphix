import { Resolver } from "node:dns/promises";
import { emailProblem } from "@/lib/account/email";

// Public resolvers, so the answer doesn't depend on the server's own DNS (some return an address for any name).
const dns = new Resolver({ timeout: 3000, tries: 2 });
dns.setServers(["1.1.1.1", "8.8.8.8"]);

// Sign-up asks this first: can the address receive mail at all? { problem: null } when it can.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.slice(0, 320) : "";
  return Response.json({ problem: await emailProblem(email, (d) => dns.resolveMx(d), (d) => dns.resolve4(d)) });
}
