import { z } from "zod";
import { accessTo, userOf } from "@/lib/auth/request";
import { estimate, marketOf, money } from "@/lib/budget/costs";
import { againstEstimate, canSendQuote, latestQuote } from "@/lib/project/quote";
import { decides, inPersonClient, nameOf, postEvent } from "@/lib/project/thread";
import { approvedLayout, newBuildOf, tierOf } from "@/lib/site/store";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Project } from "@/lib/project/store";

const cookie = (r: Request) => r.headers.get("cookie");

// The builder's quote for the build: sent by the builder, answered by whoever approves the design. Accepted, it's the
// site's budget instead of Amorphix's estimate.
async function context(request: Request, id: string) {
  const a = await accessTo(id, cookie(request));
  if (!a || a.role === "viewer") return null;
  const me = await userOf(cookie(request));
  const p = a.project as Project;
  const ownerKind = p.mode === "pro" && p.owner_id ? ((await supabaseAdmin().from("profiles").select("role").eq("user_id", p.owner_id).maybeSingle()).data?.role ?? null) : null;
  const layout = await approvedLayout(p);
  const market = marketOf(p.site?.location);
  const est = layout ? estimate(layout, tierOf(p), market, newBuildOf(p), p.site?.location).total : null;
  return { a, p, me, ownerKind, est, market };
}

export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/quote">) {
  const c = await context(request, (await ctx.params).id);
  if (!c) return Response.json({ error: "not found" }, { status: 404 });
  const quote = await latestQuote(c.p.id);
  const sender = canSendQuote(c.a.role, c.ownerKind);
  return Response.json({
    quote,
    against: quote && c.est ? againstEstimate(quote.amount, c.est.low, c.est.high).text : null,
    estimate: c.est,
    currency: c.market.currency,
    canSend: !!c.me && sender && c.p.status !== "done",
    canAnswer: !!c.me && !sender && quote?.status === "sent" && (await decides(c.p, c.a.role)),
    inPerson: await inPersonClient(c.p, c.a.role),
  });
}

const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("send"), amount: z.number().positive().max(1e12), weeks: z.number().int().min(1).max(520).optional(), note: z.string().trim().max(2000).optional() }),
  z.object({ op: z.literal("answer"), accept: z.boolean(), note: z.string().trim().max(1000).optional() }),
]);

export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/quote">) {
  const c = await context(request, (await ctx.params).id);
  if (!c || !c.me) return Response.json({ error: "not found" }, { status: 404 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "That wasn't understood." }, { status: 400 });
  const db = supabaseAdmin();
  const who = { id: c.me, name: await nameOf(c.me) };
  const o = body.data;

  if (o.op === "send") {
    if (!canSendQuote(c.a.role, c.ownerKind) || c.p.status === "done") return Response.json({ error: "Only the builder sends a quote." }, { status: 403 });
    // a new quote replaces one still waiting
    await db.from("quotes").update({ status: "withdrawn" }).eq("project_id", c.p.id).eq("status", "sent");
    const { error } = await db.from("quotes").insert({ project_id: c.p.id, builder_id: c.me, amount: o.amount, currency: c.market.currency, weeks: o.weeks ?? null, note: o.note || null });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const against = c.est ? againstEstimate(o.amount, c.est.low, c.est.high).text : undefined;
    await postEvent(c.p, who, { type: "quote", what: "sent", amount: money(o.amount, c.market), against, note: o.note || null }).catch(() => {});
    return Response.json({ ok: true });
  }

  const quote = await latestQuote(c.p.id);
  if (!quote || quote.status !== "sent") return Response.json({ error: "There's no quote waiting." }, { status: 409 });
  if (canSendQuote(c.a.role, c.ownerKind) || !(await decides(c.p, c.a.role))) return Response.json({ error: "Whoever approves the design answers the quote." }, { status: 403 });
  await db.from("quotes").update({ status: o.accept ? "accepted" : "declined", answered_by: c.me, answered_at: new Date().toISOString() }).eq("id", quote.id);
  await postEvent(c.p, who, { type: "quote", what: o.accept ? "accepted" : "declined", amount: money(quote.amount, c.market), note: o.note || null, for: await inPersonClient(c.p, c.a.role) }).catch(() => {});
  return Response.json({ ok: true });
}
