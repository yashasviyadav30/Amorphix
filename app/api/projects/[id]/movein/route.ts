import { z } from "zod";
import { remindToBill } from "@/lib/project/quote";
import { accessTo, userOf } from "@/lib/auth/request";
import { updateProject } from "@/lib/project/store";
import { decides, inPersonClient, nameOf, peopleOn, postEvent } from "@/lib/project/thread";
import { runsSite } from "@/lib/site/progress";
import { canAccept, moveInChecks, snagActions, snagStep, warrantyUntil, type SnagStatus } from "@/lib/project/movein";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Moving in: the snag list, the handover pack, the client's acceptance, and reviews of the pros afterwards.
// Whoever runs the site fixes snags and writes the pack; whoever approves the design confirms snags and accepts.

const db = () => supabaseAdmin();
const cookie = (r: Request) => r.headers.get("cookie");
const bad = (error: string, status = 400) => Response.json({ error }, { status });

type Snag = { id: number; room: string | null; note: string; status: SnagStatus; author_name: string; created_at: string };

async function context(id: string, request: Request) {
  const a = await accessTo(id, cookie(request));
  if (!a || a.role === "viewer") return null;
  const me = await userOf(cookie(request));
  const p = a.project;
  const people = await peopleOn(p);
  const runs = runsSite(a.role, p.mode, p.self_build, people.some((x) => x.role === "builder"));
  const decider = await decides(p, a.role);
  return { a, p, me, people, runs, decider };
}

export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/movein">) {
  const c = await context((await ctx.params).id, request);
  if (!c) return bad("not found", 404);
  const { a, p, me, people, runs, decider } = c;
  const [phases, snags, fees, mine, inPerson] = await Promise.all([
    db().from("site_phases").select("status").eq("project_id", p.id),
    db().from("snags").select("id, room, note, status, author_name, created_at").eq("project_id", p.id).order("created_at"),
    db().from("milestones").select("status").eq("project_id", p.id),
    me ? db().from("reviews").select("pro_id, rating, text").eq("project_id", p.id).eq("by_id", me) : { data: [] },
    inPersonClient(p, a.role),
  ]);
  const allDone = !!phases.data?.length && phases.data.every((x) => x.status === "done");
  const list = (snags.data ?? []) as Snag[];
  const feesOpen = (fees.data ?? []).filter((f) => f.status !== "received").length;
  // the pros the client can review: the architect and builder on it, or the pro whose project it is
  const raters = a.role === "client" || (a.role === "owner" && p.mode === "owner");
  const proIds = people.filter((x) => x.role === "architect" || x.role === "builder" || (x.role === "owner" && p.mode === "pro")).map((x) => ({ id: x.user_id, role: x.role }));
  // a pro who owns the project is reviewed as what they are: the architect or the builder
  const trade = async (x: { id: string; role: string }) => (x.role === "owner" ? ((await supabaseAdmin().from("profiles").select("role").eq("user_id", x.id).maybeSingle()).data?.role ?? "architect") : x.role);
  const pros = raters && p.status === "done" ? await Promise.all(proIds.map(async (x) => ({ ...x, role: await trade(x), name: await nameOf(x.id), review: (mine.data ?? []).find((r) => r.pro_id === x.id) ?? null }))) : [];
  const side = { runs, decides: decider };
  return Response.json({
    status: p.status,
    allDone,
    runs,
    decides: decider,
    inPerson,
    snags: list.map((s) => ({ ...s, actions: snagActions(s.status, side) })),
    pack: { warranty_months: p.warranty_months ?? null, note: p.handover_note ?? null, handed_over_at: p.handed_over_at ?? null, until: warrantyUntil(p.handed_over_at ?? null, p.warranty_months ?? null) },
    checks: moveInChecks({ allDone, snags: list, warrantyMonths: p.warranty_months ?? null, feesOpen, handedOver: !!p.handed_over_at, selfBuild: !!p.self_build }),
    canAccept: decider && canAccept({ status: p.status, allDone }),
    pros,
  });
}

const Op = z.discriminatedUnion("op", [
  z.object({ op: z.literal("snag.add"), note: z.string().trim().min(1).max(500), room: z.string().trim().max(60).optional() }),
  z.object({ op: z.literal("snag.step"), id: z.number().int().positive(), action: z.enum(["fix", "close", "reopen"]) }),
  z.object({ op: z.literal("pack"), warranty_months: z.number().int().min(0).max(240), note: z.string().trim().max(4000).optional() }),
  z.object({ op: z.literal("accept"), note: z.string().trim().max(1000).optional() }),
  z.object({ op: z.literal("review"), pro_id: z.uuid(), rating: z.number().int().min(1).max(5), text: z.string().trim().max(1000).optional() }),
]);

export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/movein">) {
  const c = await context((await ctx.params).id, request);
  if (!c || !c.me) return bad("not found", 404);
  const { a, p, me, people, runs, decider } = c;
  const body = Op.safeParse(await request.json().catch(() => null));
  if (!body.success) return bad("That wasn't understood.");
  const o = body.data;
  const who = { id: me, name: await nameOf(me) };
  const inPerson = await inPersonClient(p, a.role);

  switch (o.op) {
    case "snag.add": {
      // anyone on it (but viewers) can list a snag while it's being built or handed over
      if (p.status !== "building") return bad("Snags are listed while the build is being finished.", 409);
      await db().from("snags").insert({ project_id: p.id, note: o.note, room: o.room || null, created_by: me, author_name: who.name });
      await postEvent(p, who, { type: "movein", what: "snag", note: `${o.room ? `${o.room}: ` : ""}${o.note}` }).catch(() => {});
      break;
    }
    case "snag.step": {
      const { data: s } = await db().from("snags").select("id, note, status").eq("id", o.id).eq("project_id", p.id).maybeSingle();
      if (!s) return bad("not found", 404);
      const next = snagStep(s.status as SnagStatus, o.action, { runs, decides: decider });
      if (!next) return bad("That step isn't yours to take, or it's already done.", 409);
      const stamp = next === "fixed" ? { fixed_at: new Date().toISOString() } : next === "closed" ? { closed_at: new Date().toISOString() } : { fixed_at: null };
      await db().from("snags").update({ status: next, ...stamp }).eq("id", s.id).eq("status", s.status);
      await postEvent(p, who, { type: "movein", what: next === "fixed" ? "fixed" : next === "closed" ? "closed" : "reopened", note: s.note }).catch(() => {});
      break;
    }
    case "pack": {
      if (!runs) return bad("The one running the site writes the handover pack.", 403);
      await updateProject(p.id, { warranty_months: o.warranty_months, handover_note: o.note || null });
      await postEvent(p, who, { type: "movein", what: "pack", note: `${o.warranty_months}-month warranty` }).catch(() => {});
      break;
    }
    case "accept": {
      if (!decider) return bad("The client accepts the handover.", 403);
      const { data: phases } = await db().from("site_phases").select("status").eq("project_id", p.id);
      const allDone = !!phases?.length && phases.every((x) => x.status === "done");
      if (!canAccept({ status: p.status, allDone })) return bad("Every phase needs finishing before the handover.", 409);
      await updateProject(p.id, { status: "done", handed_over_at: new Date().toISOString() });
      await postEvent(p, who, { type: "movein", what: "moved", note: o.note || null, for: inPerson }).catch(() => {});
      await remindToBill(p, "handover", "The client has moved in").catch(() => {});
      break;
    }
    case "review": {
      const raters = a.role === "client" || (a.role === "owner" && p.mode === "owner");
      const isPro = people.some((x) => x.user_id === o.pro_id && (x.role === "architect" || x.role === "builder" || (x.role === "owner" && p.mode === "pro")));
      if (!raters || !isPro || p.status !== "done") return bad("Reviews come from the client once they've moved in.", 403);
      await db().from("reviews").upsert({ project_id: p.id, pro_id: o.pro_id, by_id: me, rating: o.rating, text: o.text || null }, { onConflict: "project_id,pro_id,by_id" });
      // the pro hears about it (it shows on their profile in Find a pro)
      await db().from("events").insert({ user_id: o.pro_id, project_id: p.id, kind: "rated", data: { by: who.name, project: p.title, text: `${who.name} gave you ${o.rating} out of 5${o.text ? `: "${o.text.slice(0, 100)}"` : "."}` } });
      break;
    }
  }
  return Response.json({ ok: true });
}
