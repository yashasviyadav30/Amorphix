import { z } from "zod";
import { remindToBill } from "@/lib/project/quote";
import { accessTo, userOf } from "@/lib/auth/request";
import { inspects, runsSite, withoutCosts } from "@/lib/site/progress";
import { siteOf, startSite } from "@/lib/site/store";
import { decides, nameOf, peopleOn, postEvent, inPersonClient } from "@/lib/project/thread";
import { can } from "@/lib/project/access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateProject } from "@/lib/project/store";

const cookie = (r: Request) => r.headers.get("cookie");
const db = () => supabaseAdmin();
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Id = z.number().int().positive();

// The building site: everyone on the project can see it; only the builder (or the pro who owns it) runs it.
export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/site">) {
  const a = await accessTo((await ctx.params).id, cookie(request));
  if (!a || a.role === "viewer") return Response.json({ error: "not found" }, { status: 404 });
  const me = await userOf(cookie(request));
  const p = a.project;
  const today = Day.safeParse(new URL(request.url).searchParams.get("today")).data;
  const [site, people, approves, inPerson] = await Promise.all([siteOf(p, today), peopleOn(p), decides(p, a.role), inPersonClient(p, a.role)]);
  const runs = runsSite(a.role, p.mode, p.self_build, people.some((x) => x.role === "builder"));
  const ownerKind = p.mode === "pro" && p.owner_id ? ((await db().from("profiles").select("role").eq("user_id", p.owner_id).maybeSingle()).data?.role ?? null) : null;
  const inspector = inspects(a.role, p.mode, ownerKind);
  const roster = runs && me ? await db().from("crew").select("id, name, trade, phone, day_rate").eq("owner_id", me).eq("active", true).order("name").then((r) => r.data ?? []) : [];
  // What it takes to get building, for the screen before the site starts.
  const steps = {
    chosen: p.chosen_option !== null,
    canSend: can(a.role, "review"),
    approves,
    builder: people.some((x) => x.role === "builder"),
    owner: a.role === "owner",
    selfBuild: !!p.self_build,
    inPerson,
  };
  return Response.json({ site: site && !runs ? withoutCosts(site) : site, runs, inspects: inspector, status: p.status, roster, steps });
}

const Photo = z.object({ path: z.string().max(300), name: z.string().max(200), type: z.string().max(100), size: z.number().int().min(0).max(10_485_760) });
const Op = z.discriminatedUnion("op", [
  z.object({ op: z.literal("self"), on: z.boolean() }),
  z.object({ op: z.literal("start"), start: Day }),
  z.object({ op: z.literal("phase"), id: Id, pct: z.number().int().min(0).max(100).optional(), start_date: Day.optional(), end_date: Day.optional() }),
  z.object({ op: z.literal("task.add"), title: z.string().trim().min(1).max(120), phase_id: Id.nullable().optional(), crew_id: Id.nullable().optional(), due: Day.nullable().optional() }),
  z.object({ op: z.literal("task.set"), id: Id, status: z.enum(["todo", "doing", "done"]) }),
  z.object({ op: z.literal("task.del"), id: Id }),
  z.object({ op: z.literal("crew.add"), name: z.string().trim().min(1).max(80), trade: z.string().trim().max(40).optional(), phone: z.string().trim().max(30).optional(), day_rate: z.number().min(0).max(1e7).default(0) }),
  z.object({ op: z.literal("crew.attach"), crew_id: Id }),
  z.object({ op: z.literal("crew.remove"), crew_id: Id }),
  z.object({ op: z.literal("attend"), crew_id: Id, day: Day, present: z.boolean(), hours: z.number().min(0).max(24).default(8) }),
  z.object({ op: z.literal("material.add"), name: z.string().trim().min(1).max(80), unit: z.string().trim().min(1).max(20), needed: z.number().min(0).max(1e9), unit_cost: z.number().min(0).max(1e9).default(0) }),
  z.object({ op: z.literal("material.set"), id: Id, needed: z.number().min(0).max(1e9).optional(), used: z.number().min(0).max(1e9).optional() }),
  z.object({ op: z.literal("order.add"), material_id: Id, qty: z.number().positive().max(1e9), supplier: z.string().trim().max(80).optional(), cost: z.number().min(0).max(1e12).default(0), eta: Day.nullable().optional() }),
  z.object({ op: z.literal("order.deliver"), id: Id }),
  z.object({ op: z.literal("visit"), note: z.string().trim().min(1).max(2000), visited_on: Day.optional() }),
  z.object({ op: z.literal("signoff"), id: Id, note: z.string().trim().max(1000).optional() }),
  z.object({ op: z.literal("update"), note: z.string().trim().min(1).max(2000), phase_id: Id.nullable().optional(), pct: z.number().int().min(0).max(100).optional(), photos: z.array(Photo).max(8).default([]) }),
]);

const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/site">) {
  const id = (await ctx.params).id;
  const a = await accessTo(id, cookie(request));
  const me = await userOf(cookie(request));
  if (!a || !me) return bad("not found", 404);
  const body = Op.safeParse(await request.json().catch(() => null));
  if (!body.success) return bad("That wasn't understood.");
  const o = body.data;
  const p = a.project;
  // The owner decides to run the build themselves (or leaves it to a builder), before the site starts.
  if (o.op === "self") {
    if (a.role !== "owner") return bad("Only the owner decides who runs the build.", 403);
    await updateProject(id, { self_build: o.on });
    return Response.json({ ok: true });
  }
  // the architect's part in the build: visits to the site, and signing off each finished stage
  if (o.op === "visit" || o.op === "signoff") {
    const ownerKind = p.mode === "pro" && p.owner_id ? ((await db().from("profiles").select("role").eq("user_id", p.owner_id).maybeSingle()).data?.role ?? null) : null;
    if (!inspects(a.role, p.mode, ownerKind)) return bad("Only the architect visits and signs off the build.", 403);
    const who = { id: me, name: await nameOf(me) };
    if (o.op === "visit") {
      await db().from("site_visits").insert({ project_id: id, author_id: me, author_name: who.name, note: o.note, ...(o.visited_on ? { visited_on: o.visited_on } : {}) });
      await postEvent(p, who, { type: "visit", note: o.note }).catch(() => {});
      return Response.json({ ok: true });
    }
    const { data: ph } = await db().from("site_phases").select("name, status, signed_off_at").eq("id", o.id).eq("project_id", id).maybeSingle();
    if (!ph) return bad("not found", 404);
    if (ph.status !== "done") return bad("A stage is signed off once it's finished.", 409);
    if (ph.signed_off_at) return bad("This stage is already signed off.", 409);
    await db().from("site_phases").update({ signed_off_at: new Date().toISOString(), signed_off_by: who.name, signed_off_note: o.note || null }).eq("id", o.id);
    await postEvent(p, who, { type: "signoff", name: ph.name, note: o.note || null }).catch(() => {});
    return Response.json({ ok: true });
  }
  const builder = !!(await db().from("project_members").select("user_id").eq("project_id", id).eq("role", "builder").limit(1).maybeSingle()).data;
  if (!runsSite(a.role, p.mode, p.self_build, builder)) return bad("Only the builder runs the site.", 403);
  const who = { id: me, name: await nameOf(me) };
  // Every row a request names must belong to this project (or, for crew, to this builder).
  const ours = async (table: string, rowId: number) => !!(await db().from(table).select("id").eq("id", rowId).eq("project_id", id).maybeSingle()).data;
  const myCrew = async (crewId: number) => !!(await db().from("crew").select("id").eq("id", crewId).eq("owner_id", me).maybeSingle()).data;

  switch (o.op) {
    case "start": {
      if (p.status !== "approved" && p.status !== "building") return bad("The design needs approving before the site starts.", 409);
      try {
        const s = await startSite(p, new Date(`${o.start}T00:00:00Z`));
        await postEvent(p, who, { type: "site", what: "started", name: s.first }).catch(() => {});
        await remindToBill(p, "start", "The site has started").catch(() => {});
      } catch (e) {
        return bad(e instanceof Error ? e.message : "Couldn't start the site.", 409);
      }
      break;
    }
    case "phase": {
      if (!(await ours("site_phases", o.id))) return bad("not found", 404);
      const patch: Record<string, unknown> = {};
      if (o.start_date) patch.start_date = o.start_date;
      if (o.end_date) patch.end_date = o.end_date;
      if (o.pct !== undefined) {
        patch.pct = o.pct;
        patch.status = o.pct >= 100 ? "done" : o.pct > 0 ? "active" : "planned";
      }
      const { data: ph } = await db().from("site_phases").update(patch).eq("id", o.id).select("key, name, status").single();
      if (ph?.status === "done") {
        await postEvent(p, who, { type: "site", what: "phase", name: ph.name }, true).catch(() => {});
        await remindToBill(p, ph.key, `${ph.name} is done`).catch(() => {});
        // The next phase starts; when none is left, the build is finished and the handover begins (moving in is
        // the client's acceptance, in the Move in section).
        const { data: rest } = await db().from("site_phases").select("id, status").eq("project_id", id).neq("status", "done").order("position").limit(1);
        if (rest?.[0]) await db().from("site_phases").update({ status: "active" }).eq("id", rest[0].id).eq("status", "planned");
        else await postEvent(p, who, { type: "site", what: "finished" }).catch(() => {});
      }
      break;
    }
    case "task.add":
      if (o.phase_id && !(await ours("site_phases", o.phase_id))) return bad("not found", 404);
      if (o.crew_id && !(await myCrew(o.crew_id))) return bad("not found", 404);
      await db().from("site_tasks").insert({ project_id: id, title: o.title, phase_id: o.phase_id ?? null, crew_id: o.crew_id ?? null, due: o.due ?? null });
      break;
    case "task.set":
      if (!(await ours("site_tasks", o.id))) return bad("not found", 404);
      await db().from("site_tasks").update({ status: o.status, done_at: o.status === "done" ? new Date().toISOString() : null }).eq("id", o.id);
      break;
    case "task.del":
      await db().from("site_tasks").delete().eq("id", o.id).eq("project_id", id);
      break;
    case "crew.add": {
      const { data: c, error } = await db().from("crew").insert({ owner_id: me, name: o.name, trade: o.trade || null, phone: o.phone || null, day_rate: o.day_rate }).select("id").single();
      if (error || !c) return bad("Couldn't add them.", 500);
      await db().from("site_crew").upsert({ project_id: id, crew_id: c.id });
      break;
    }
    case "crew.attach":
      if (!(await myCrew(o.crew_id))) return bad("not found", 404);
      await db().from("site_crew").upsert({ project_id: id, crew_id: o.crew_id });
      break;
    case "crew.remove":
      await db().from("site_crew").delete().eq("project_id", id).eq("crew_id", o.crew_id);
      break;
    case "attend": {
      const { data: on } = await db().from("site_crew").select("crew_id").eq("project_id", id).eq("crew_id", o.crew_id).maybeSingle();
      if (!on) return bad("not found", 404);
      await db().from("attendance").upsert({ project_id: id, crew_id: o.crew_id, day: o.day, present: o.present, hours: o.present ? o.hours : 0 });
      break;
    }
    case "material.add":
      await db().from("materials").insert({ project_id: id, name: o.name, unit: o.unit, needed: o.needed, unit_cost: o.unit_cost });
      break;
    case "material.set": {
      if (!(await ours("materials", o.id))) return bad("not found", 404);
      const patch: Record<string, number> = {};
      if (o.needed !== undefined) patch.needed = o.needed;
      if (o.used !== undefined) patch.used = o.used;
      await db().from("materials").update(patch).eq("id", o.id);
      break;
    }
    case "order.add": {
      const { data: m } = await db().from("materials").select("id, ordered").eq("id", o.material_id).eq("project_id", id).maybeSingle();
      if (!m) return bad("not found", 404);
      await db().from("material_orders").insert({ project_id: id, material_id: m.id, qty: o.qty, supplier: o.supplier || null, cost: o.cost, eta: o.eta ?? null });
      await db().from("materials").update({ ordered: Number(m.ordered) + o.qty }).eq("id", m.id);
      break;
    }
    case "order.deliver": {
      // Only an order still on its way can arrive, and only once.
      const { data: done } = await db().from("material_orders").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", o.id).eq("project_id", id).eq("status", "ordered").select("material_id, qty");
      const d = done?.[0];
      if (!d) return bad("That order has already arrived.", 409);
      const { data: m } = await db().from("materials").select("delivered").eq("id", d.material_id).single();
      await db().from("materials").update({ delivered: Number(m?.delivered ?? 0) + Number(d.qty) }).eq("id", d.material_id);
      break;
    }
    case "update": {
      if (o.photos.some((f) => !f.path.startsWith(`${id}/`))) return bad("That photo isn't part of this project.");
      let phaseName: string | undefined;
      if (o.phase_id) {
        const { data: ph } = await db().from("site_phases").select("name").eq("id", o.phase_id).eq("project_id", id).maybeSingle();
        if (!ph) return bad("not found", 404);
        phaseName = ph.name;
      }
      await db().from("site_updates").insert({ project_id: id, phase_id: o.phase_id ?? null, author_id: me, author_name: who.name, note: o.note, pct: o.pct ?? null, photos: o.photos });
      if (o.phase_id && o.pct !== undefined) await db().from("site_phases").update({ pct: o.pct, status: o.pct >= 100 ? "done" : "active" }).eq("id", o.phase_id);
      await postEvent(p, who, { type: "site", what: "update", name: phaseName, pct: o.pct, note: o.note }).catch(() => {});
      break;
    }
  }
  return Response.json({ ok: true });
}
