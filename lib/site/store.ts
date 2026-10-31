import { supabaseAdmin } from "../supabase/admin.ts";
import { acceptedQuotes, siteBudget } from "../project/quote.ts";
import { timeline } from "../budget/timeline.ts";
import { estimate, isNewBuild, marketOf, projectTier, type Tier } from "../budget/costs.ts";
import { latestVersion, updateProject, type Project } from "../project/store.ts";
import { seedMaterials, seedPhases, isoDay } from "./plan.ts";
import { alertsFor, labourCost, overallPct, currentPhase, type MaterialRow, type PhaseRow, type TaskRow } from "./progress.ts";

// The building site's data: starting it from the approved design, and reading everything about it in one go.

const db = () => supabaseAdmin();

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export const tierOf = (p: Project): Tier => projectTier(p);
export const newBuildOf = (p: Project) => isNewBuild(p);

/** The approved design: the latest saved version, else the chosen plan. */
export async function approvedLayout(p: Project) {
  const v = await latestVersion(p.id);
  return v?.layout ?? (p.chosen_option !== null ? p.options?.[p.chosen_option] : null) ?? null;
}

/** Start the site on `start`: phases from the design's timeline, materials taken off the plan, the first phase underway. */
export async function startSite(p: Project, start: Date) {
  const layout = await approvedLayout(p);
  if (!layout) throw new Error("There's no approved design to build yet.");
  const existing = await must<{ id: number }[]>(db().from("site_phases").select("id").eq("project_id", p.id).limit(1));
  if (existing.length) throw new Error("The site has already started.");
  const tier = tierOf(p);
  const nb = newBuildOf(p);
  const phases = seedPhases(timeline(layout, tier, nb), start);
  await must(
    db()
      .from("site_phases")
      .insert(phases.map((ph, i) => ({ project_id: p.id, key: ph.key, name: ph.name, note: ph.note, position: ph.position, start_date: ph.start, end_date: ph.end, status: i === 0 ? "active" : "planned" }))),
  );
  const est = estimate(layout, tier, marketOf(p.site?.location), nb, p.site?.location);
  const mats = seedMaterials(layout, est, nb, p.site?.units ?? "metric");
  if (mats.length) await must(db().from("materials").insert(mats.map((m) => ({ project_id: p.id, name: m.name, unit: m.unit, phase: m.phase, needed: m.needed, unit_cost: m.unitCost }))));
  await updateProject(p.id, { status: "building" });
  return { first: phases[0]?.name ?? "the first phase", budget: est.total, currency: est.market.currency };
}

const num = <T extends Record<string, unknown>>(rows: T[], keys: (keyof T)[]) => rows.map((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, Number(r[k])])) }) as T);

export type Site = Awaited<ReturnType<typeof siteOf>>;

/** Everything about a site for one screen: phases, tasks, crew and today's attendance, materials and orders,
 *  photo updates, progress, money spent, and alerts. */
export async function siteOf(p: Project, today = isoDay(new Date())) {
  const [phases, tasks, crewLinks, materials, orders, updates, attendance, visits] = await Promise.all([
    must<PhaseRow[]>(db().from("site_phases").select("id, key, name, note, position, start_date, end_date, status, pct, signed_off_at, signed_off_by, signed_off_note").eq("project_id", p.id).order("position")),
    must<(TaskRow & { crew_id: number | null })[]>(db().from("site_tasks").select("id, title, due, status, phase_id, crew_id").eq("project_id", p.id).order("created_at")),
    // The join returns one crew member per row (typed as a list by the client).
    must(db().from("site_crew").select("crew(id, name, trade, phone, day_rate, active)").eq("project_id", p.id)) as unknown as Promise<
      { crew: { id: number; name: string; trade: string | null; phone: string | null; day_rate: number; active: boolean } | null }[]
    >,
    must<MaterialRow[]>(db().from("materials").select("id, name, unit, phase, needed, ordered, delivered, used, unit_cost").eq("project_id", p.id).order("id")),
    must<{ id: number; material_id: number; qty: number; supplier: string | null; cost: number; eta: string | null; status: string; created_at: string }[]>(
      db().from("material_orders").select("id, material_id, qty, supplier, cost, eta, status, created_at").eq("project_id", p.id).order("created_at", { ascending: false }),
    ),
    must<{ id: number; phase_id: number | null; author_name: string; note: string; pct: number | null; photos: { path: string; name: string; type: string; size: number; url?: string }[]; created_at: string }[]>(
      db().from("site_updates").select("id, phase_id, author_name, note, pct, photos, created_at").eq("project_id", p.id).order("created_at", { ascending: false }).limit(50),
    ),
    must<{ crew_id: number; day: string; present: boolean; hours: number }[]>(db().from("attendance").select("crew_id, day, present, hours").eq("project_id", p.id)),
    must<{ id: number; author_name: string; visited_on: string; note: string }[]>(db().from("site_visits").select("id, author_name, visited_on, note").eq("project_id", p.id).order("visited_on", { ascending: false }).limit(30)),
  ]);
  if (!phases.length) return null;

  const crew = crewLinks.map((c) => c.crew).filter((c): c is NonNullable<typeof c> => !!c).map((c) => ({ ...c, day_rate: Number(c.day_rate) }));
  const rate = new Map(crew.map((c) => [c.id, c.day_rate]));
  const mats = num(materials, ["needed", "ordered", "delivered", "used", "unit_cost"]);
  const ords = num(orders, ["qty", "cost"]);
  const att = num(attendance, ["hours"]);
  const todayRows = att.filter((a) => a.day === today);

  // Photos are private: short-lived links, like the thread's.
  const paths = updates.flatMap((u) => u.photos.map((f) => f.path));
  if (paths.length) {
    const { data } = await db().storage.from("thread").createSignedUrls(paths, 60 * 60);
    const url = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
    for (const u of updates) u.photos = u.photos.map((f) => ({ ...f, url: url.get(f.path) ?? undefined }));
  }

  const labour = labourCost(att.map((a) => ({ present: a.present, hours: a.hours, day_rate: rate.get(a.crew_id) ?? 0 })));
  const materialSpend = Math.round(ords.reduce((s, o) => s + o.cost, 0));
  const layout = await approvedLayout(p);
  const est = layout ? estimate(layout, tierOf(p), marketOf(p.site?.location), newBuildOf(p), p.site?.location) : null;
  // the builder's accepted quote is the budget, not Amorphix's estimate
  const quoted = (await acceptedQuotes([p.id])).get(p.id) ?? null;
  return {
    today,
    phases,
    current: currentPhase(phases),
    overall: overallPct(phases),
    tasks,
    crew,
    attendanceToday: todayRows,
    materials: mats,
    orders: ords,
    updates,
    visits,
    money: { labour, materials: materialSpend, spent: labour + materialSpend, budget: siteBudget(est?.total ?? null, quoted), quoted: !!quoted, currency: est?.market.currency ?? "INR" },
    alerts: alertsFor({ phases, tasks, materials: mats, onSiteToday: todayRows.filter((a) => a.present).length, today }),
  };
}

/** A builder's active sites at a glance: progress, the phase in hand, and who is on site today. */
export async function sitesToday(projectIds: string[], today = isoDay(new Date())) {
  if (!projectIds.length) return [];
  const [phases, att] = await Promise.all([
    must<(PhaseRow & { project_id: string })[]>(db().from("site_phases").select("id, project_id, key, name, start_date, end_date, status, pct, position").in("project_id", projectIds).order("position")),
    must<{ project_id: string; present: boolean }[]>(db().from("attendance").select("project_id, present").in("project_id", projectIds).eq("day", today)),
  ]);
  return projectIds
    .map((id) => {
      const ph = phases.filter((x) => x.project_id === id);
      if (!ph.length) return null;
      return { id, overall: overallPct(ph), now: currentPhase(ph)?.name ?? null, onSite: att.filter((a) => a.project_id === id && a.present).length, late: alertsFor({ phases: ph, tasks: [], materials: [], onSiteToday: 1, today }).length };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}
