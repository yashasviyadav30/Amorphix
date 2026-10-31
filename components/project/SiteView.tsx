"use client";

import { QuoteCard } from "./QuoteCard";
import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Scanning, Bar } from "@/components/fx/Motion";
import { Decode } from "@/components/fx/Decode";
import { ok, tick } from "@/components/fx/sfx";
import { money } from "@/lib/project/fees";
import { expectedPct, stockOf } from "@/lib/site/progress";
import { MoveIn } from "./MoveIn";

type Phase = { id: number; key: string; name: string; note: string | null; start_date: string; end_date: string; status: "planned" | "active" | "done"; pct: number; signed_off_at?: string | null; signed_off_by?: string | null; signed_off_note?: string | null };
type Task = { id: number; title: string; due: string | null; status: "todo" | "doing" | "done"; phase_id: number | null; crew_id: number | null };
type Crew = { id: number; name: string; trade: string | null; phone: string | null; day_rate?: number };
type Material = { id: number; name: string; unit: string; phase: string | null; needed: number; ordered: number; delivered: number; used: number; unit_cost?: number };
type Order = { id: number; material_id: number; qty: number; supplier: string | null; cost?: number; eta: string | null; status: string; created_at: string };
type Update = { id: number; phase_id: number | null; author_name: string; note: string; pct: number | null; photos: { path: string; name: string; type: string; url?: string }[]; created_at: string };
type Site = {
  today: string;
  phases: Phase[];
  current: Phase | null;
  overall: number;
  tasks: Task[];
  crew: Crew[];
  attendanceToday: { crew_id: number; present: boolean; hours: number }[];
  materials: Material[];
  orders: Order[];
  updates: Update[];
  visits?: { id: number; author_name: string; visited_on: string; note: string }[];
  money: { labour?: number; materials?: number; spent?: number; budget: { low: number; high: number } | null; quoted?: boolean; currency: string };
  alerts: { kind: string; text: string }[];
};
type Data = { site: Site | null; runs: boolean; inspects?: boolean; status: string; roster: Crew[]; steps: Steps };

const SECTIONS = [
  ["movein", "Move in"],
  ["today", "Today"],
  ["phases", "Phases & tasks"],
  ["crew", "Crew"],
  ["materials", "Materials"],
  ["updates", "Updates"],
] as const;
type Section = (typeof SECTIONS)[number][0];

const localDay = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" });
const input = "rounded-full border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-accent";

// The building site. The builder runs it here (phases, tasks, crew and attendance, materials and orders, photo
// updates); the owner, client and architect follow it read only. Every change posts what matters in the thread.
export function SiteView({ projectId, onStatus, onPlans, onTeam }: { projectId: string; onStatus: (s: string) => void; onPlans?: () => void; onTeam?: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  // null: the default, which is Move in once the build is finished, else Today
  const [picked, setSection] = useState<Section | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = localDay();

  const load = useCallback(
    () =>
      fetch(`/api/projects/${projectId}/site?today=${today}`)
        .then((r) => (r.ok ? (r.json() as Promise<Data>) : Promise.reject()))
        .then((d) => {
          setData(d);
          onStatus(d.status);
        })
        .catch(() => setError("Couldn't load the site.")),
    [projectId, today, onStatus],
  );
  useEffect(() => {
    void load();
  }, [load]);

  /** One site action; the screen reloads after it, whatever happened. */
  const act = useCallback(
    async (body: Record<string, unknown>, sound = true) => {
      setBusy(true);
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/site`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      setBusy(false);
      await load();
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "That didn't go through.");
        return false;
      }
      if (sound) ok();
      return true;
    },
    [projectId, load],
  );

  /** Send the design for review, or approve it, from the site's first screen (the thread shows it too). */
  // "both": an owner on their own sends it and approves it in one go; there's no one else to ask
  const review = async (action: "send" | "approve" | "both") => {
    setBusy(true);
    setError(null);
    for (const step of action === "both" ? (["send", "approve"] as const) : [action]) {
      const res = await fetch(`/api/projects/${projectId}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: step }) });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "That didn't go through.");
        break;
      }
      if (step === (action === "both" ? "approve" : action)) ok();
    }
    setBusy(false);
    await load();
  };

  if (!data)
    return (
      <div className="grid place-items-center py-16">
        <Scanning label="Loading the site" />
      </div>
    );
  const { site, runs } = data;
  // the snag list and handover start with the last phase, as on a real site, not once everything is at 100%
  const finishing = !!site && (site.overall >= 100 || data.status === "done" || (site.phases.at(-1)?.status ?? "planned") !== "planned");
  const shown = SECTIONS.filter(([id]) => id !== "movein" || finishing);
  const section = picked ?? (finishing ? "movein" : "today");
  const at: Section = section === "movein" && !finishing ? "today" : section;
  if (!site) return <NotStarted projectId={projectId} data={data} act={act} busy={busy} error={error} review={review} onPlans={onPlans} onTeam={onTeam} />;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16">
      <Header site={site} status={data.status} />
      <div className="mt-4 flex flex-wrap gap-1.5">
        {shown.map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              tick();
              setSection(id);
            }}
            aria-pressed={at === id}
            className={`rounded-full px-3.5 py-1.5 text-sm transition ${at === id ? "bg-btn text-btn-ink" : "border border-line text-ink-soft hover:text-ink"}`}
          >
            {label}
            {id === "today" && site.alerts.length > 0 && <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[11px] text-white">{site.alerts.length}</span>}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <motion.div key={at} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
        {at === "today" && (
          <div className="mb-4">
            <QuoteCard projectId={projectId} onChange={() => void load()} />
          </div>
        )}
        {at === "movein" && <MoveIn projectId={projectId} onStatus={onStatus} />}
        {at === "today" && <Today site={site} runs={runs} act={act} today={today} busy={busy} />}
        {at === "phases" && <Phases site={site} runs={runs} inspects={!!data.inspects} act={act} busy={busy} />}
        {at === "crew" && <CrewPanel site={site} runs={runs} roster={data.roster} act={act} today={today} busy={busy} />}
        {at === "materials" && <Materials site={site} runs={runs} act={act} busy={busy} />}
        {at === "updates" && (
          <>
            <Visits site={site} inspects={!!data.inspects} act={act} busy={busy} />
            <Updates projectId={projectId} site={site} runs={runs} act={act} busy={busy} />
          </>
        )}
      </motion.div>
      {/* a save can take a few seconds: say so where it's seen */}
      <p aria-live="polite" className={`pointer-events-none fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-btn px-4 py-2 text-sm text-btn-ink shadow-lg transition ${busy ? "opacity-100" : "opacity-0"}`}>
        {busy ? "Saving…" : ""}
      </p>
    </main>
  );
}

type Act = (body: Record<string, unknown>, sound?: boolean) => Promise<boolean>;

type Steps = { chosen: boolean; canSend: boolean; approves: boolean; builder: boolean; owner: boolean; selfBuild: boolean; inPerson?: string | null };

/** Before the site starts: the three steps to get building, each with what to do next. */
function NotStarted({ projectId, data, act, busy, error, review, onPlans, onTeam }: { projectId: string; data: Data; act: Act; busy: boolean; error: string | null; review: (action: "send" | "approve" | "both") => void; onPlans?: () => void; onTeam?: () => void }) {
  const [start, setStart] = useState(localDay());
  const { runs, status, steps: s } = data;
  const approved = status === "approved" || status === "building" || status === "done";
  const sent = status === "review" || approved;
  const step = !s.chosen ? 0 : !approved ? 1 : 2;
  const btn = "glow-btn rounded-full px-5 py-2 text-sm disabled:opacity-60";
  const quiet = "rounded-full border border-line px-5 py-2 text-sm transition hover:border-accent disabled:opacity-60";

  const rows: { title: string; done: boolean; body: React.ReactNode }[] = [
    {
      title: "Pick a plan",
      done: s.chosen,
      body: onPlans && (
        <button onClick={onPlans} className={btn}>
          See the plans
        </button>
      ),
    },
    {
      title: "Approve the design",
      done: approved,
      body:
        status === "review" ? (
          s.approves ? (
            <button onClick={() => review("approve")} disabled={busy} className={btn}>
              {s.inPerson ? `${s.inPerson} approved it (in person)` : "Approve this design"}
            </button>
          ) : (
            <p className="text-sm text-ink-soft">Waiting for the client to approve it in the thread.</p>
          )
        ) : !sent && s.canSend ? (
          <button onClick={() => review(s.approves && !s.inPerson ? "both" : "send")} disabled={busy} className={btn}>
            {busy ? "Saving…" : s.approves && !s.inPerson ? "Approve this design" : "Send for review"}
          </button>
        ) : (
          <p className="text-sm text-ink-soft">The design is being finished; it comes for review in the thread.</p>
        ),
    },
    {
      title: "Start building",
      done: false,
      body: runs ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-ink-soft" htmlFor="start">
            Start on
          </label>
          <input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className={input} />
          <button onClick={() => act({ op: "start", start })} disabled={busy || !approved} className={btn}>
            {busy ? "Setting up…" : "Start the site"}
          </button>
          {s.selfBuild && (
            <button onClick={() => act({ op: "self", on: false }, false)} disabled={busy} className="text-xs text-ink-soft underline">
              Leave it to a builder instead
            </button>
          )}
        </div>
      ) : s.owner && s.builder ? (
        // the builder they brought in runs the site; nothing for the owner to pick here
        <p className="text-sm text-ink-soft">Your builder starts the site from here. You&apos;ll follow every phase, photo and cost.</p>
      ) : s.owner ? (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => act({ op: "self", on: true })} disabled={busy} className={btn}>
            I&apos;m managing the build myself
          </button>
          {!s.builder && onTeam && (
            <button onClick={onTeam} className={quiet}>
              Invite my builder
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-soft">{s.builder ? "The builder starts the site from here." : "Once a builder joins, they start the site from here."}</p>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-center font-mono text-xs uppercase tracking-[0.3em] text-accent">The building site</p>
      <h2 className="mt-3 text-center font-serif text-4xl">
        <Decode text={runs && approved ? "Ready to start building?" : "Three steps to the site"} />
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-ink-soft">
        Once building starts, this is where it runs: phases from the design&apos;s timeline, materials taken off the approved plan with
        quantities and costs, crew and attendance, orders, and photo updates everyone can follow.
      </p>
      <ol className="mt-8 grid gap-3">
        {rows.map((r, i) => (
          <motion.li
            key={r.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i }}
            className={`rounded-2xl border bg-paper-raised p-4 ${i === step ? "border-accent/60" : "border-line"}`}
          >
            <div className="flex items-center gap-3">
              <span className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs ${r.done ? "bg-leaf text-white" : i === step ? "bg-accent text-white" : "bg-line/60 text-ink-soft"}`}>
                {r.done ? "✓" : i + 1}
              </span>
              <h3 className={`font-medium ${i > step ? "text-ink-soft" : ""}`}>{r.title}</h3>
            </div>
            {i === step && <div className="mt-3 pl-10">{r.body}</div>}
          </motion.li>
        ))}
      </ol>
      {/* the builder's price for the build, before the site starts */}
      <div className="mt-4">
        <QuoteCard projectId={projectId} />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-red-600">
          {error}
        </p>
      )}
    </main>
  );
}

function Header({ site, status }: { site: Site; status?: string }) {
  const m = site.money;
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-line bg-paper-raised p-4">
        <p className="text-xs uppercase tracking-widest text-ink-soft">Built</p>
        <p className="mt-1 font-serif text-4xl">{site.overall}%</p>
        <Bar pct={site.overall} className="mt-2 h-1.5 bg-leaf" />
      </div>
      <div className="rounded-2xl border border-line bg-paper-raised p-4">
        <p className="text-xs uppercase tracking-widest text-ink-soft">Now</p>
        <p className="mt-1 font-serif text-2xl leading-tight">{site.current?.name ?? (status === "done" ? "Handed over" : "Built: the handover is next")}</p>
        {site.current && (
          <p className="text-sm text-ink-soft">
            {site.current.pct}% · {short(site.current.start_date)} to {short(site.current.end_date)}
          </p>
        )}
      </div>
      <div className="rounded-2xl border border-line bg-paper-raised p-4">
        {m.spent !== undefined ? (
          <>
            <p className="text-xs uppercase tracking-widest text-ink-soft">Spent</p>
            <p className="mt-1 font-serif text-2xl">{money(m.spent, m.currency)}</p>
            <p className="text-sm text-ink-soft">
              Labour {money(m.labour ?? 0, m.currency)} · materials {money(m.materials ?? 0, m.currency)}
              {m.budget && <> · {m.quoted ? `quote ${money(m.budget.low, m.currency)}` : `budget ${money(m.budget.low, m.currency)} to ${money(m.budget.high, m.currency)}`}</>}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-ink-soft">{m.quoted ? "Builder's quote" : "Budget"}</p>
            <p className="mt-1 font-serif text-2xl">{m.budget ? (m.quoted ? money(m.budget.low, m.currency) : `${money(m.budget.low, m.currency)} to ${money(m.budget.high, m.currency)}`) : "Set by the builder"}</p>
            <p className="text-sm text-ink-soft">The builder&apos;s own costs stay with the builder.</p>
          </>
        )}
      </div>
    </section>
  );
}

function Today({ site, runs, act, today, busy }: { site: Site; runs: boolean; act: Act; today: string; busy: boolean }) {
  const due = site.tasks.filter((t) => t.status !== "done" && t.due && t.due <= today);
  const here = new Set(site.attendanceToday.filter((a) => a.present).map((a) => a.crew_id));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-line bg-paper-raised p-4">
        <p className="font-medium">Needs attention</p>
        {site.alerts.length === 0 ? (
          <p className="mt-2 text-sm text-leaf">✓ All on track.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {site.alerts.map((a, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                {a.text}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-2xl border border-line bg-paper-raised p-4">
        <p className="font-medium">
          On site today · {here.size} of {site.crew.length}
        </p>
        {site.crew.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">{runs ? "Add your crew under Crew." : "No crew added yet."}</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {site.crew.map((c) => (
              <li key={c.id}>
                <button
                  disabled={!runs || busy}
                  onClick={() => act({ op: "attend", crew_id: c.id, day: today, present: !here.has(c.id) }, false).then(() => tick())}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${here.has(c.id) ? "border-leaf bg-leaf/10 text-leaf" : "border-line text-ink-soft"} ${runs ? "hover:-translate-y-0.5" : ""}`}
                >
                  {here.has(c.id) ? "✓ " : ""}
                  {c.name}
                  {c.trade && <span className="opacity-70"> · {c.trade}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {runs && site.crew.length > 0 && <p className="mt-2 text-xs text-ink-soft">Tap someone to mark them on site today.</p>}
      </section>
      <section className="rounded-2xl border border-line bg-paper-raised p-4 lg:col-span-2">
        <p className="font-medium">Due now</p>
        {due.length === 0 ? <p className="mt-2 text-sm text-ink-soft">Nothing due today.</p> : <TaskList tasks={due} site={site} runs={runs} act={act} busy={busy} />}
      </section>
    </div>
  );
}

function TaskList({ tasks, site, runs, act, busy }: { tasks: Task[]; site: Site; runs: boolean; act: Act; busy: boolean }) {
  const who = (id: number | null) => site.crew.find((c) => c.id === id)?.name;
  const next = { todo: "doing", doing: "done", done: "todo" } as const;
  return (
    <ul className="mt-2 space-y-1.5">
      {tasks.map((t) => (
        <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
          <span className={t.status === "done" ? "text-ink-soft line-through" : ""}>
            {t.title}
            {who(t.crew_id) && <span className="text-ink-soft"> · {who(t.crew_id)}</span>}
            {t.due && <span className="text-ink-soft"> · due {short(t.due)}</span>}
          </span>
          <span className="flex items-center gap-2">
            <button
              disabled={!runs || busy}
              onClick={() => act({ op: "task.set", id: t.id, status: next[t.status] })}
              className={`rounded-full px-2.5 py-0.5 text-xs ${t.status === "done" ? "bg-leaf/15 text-leaf" : t.status === "doing" ? "bg-accent/15 text-accent" : "bg-line/60 text-ink-soft"}`}
            >
              {t.status === "todo" ? "To do" : t.status === "doing" ? "Doing" : "Done"}
            </button>
            {runs && (
              <button onClick={() => act({ op: "task.del", id: t.id }, false)} aria-label={`Delete ${t.title}`} className="text-xs text-ink-soft hover:text-red-600">
                ✕
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Phases({ site, runs, inspects, act, busy }: { site: Site; runs: boolean; inspects: boolean; act: Act; busy: boolean }) {
  const [adding, setAdding] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [crew, setCrew] = useState("");
  return (
    <ol className="space-y-3">
      {site.phases.map((p, i) => {
        const tasks = site.tasks.filter((t) => t.phase_id === p.id);
        const expect = expectedPct(p, site.today);
        return (
          <motion.li key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }} className={`rounded-2xl border bg-paper-raised p-4 ${p.status === "active" ? "border-accent/60" : "border-line"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {p.status === "done" ? "✓ " : ""}
                {p.name}
              </p>
              <p className="text-sm text-ink-soft">
                {short(p.start_date)} to {short(p.end_date)}
                {p.status !== "done" && expect > 0 && <> · {expect}% expected by now</>}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <motion.div className={`h-full ${p.status === "done" ? "bg-leaf" : "bg-accent"}`} initial={{ width: 0 }} animate={{ width: `${p.pct}%` }} />
              </div>
              {runs && p.status !== "done" ? (
                <select value={p.pct} disabled={busy} onChange={(e) => act({ op: "phase", id: p.id, pct: Number(e.target.value) })} aria-label={`${p.name} progress`} className="rounded-full border border-line bg-paper px-2 py-1 text-xs">
                  {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((n) => (
                    <option key={n} value={n}>
                      {n === 100 ? "Done" : `${n}%`}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-ink-soft">{p.pct}%</span>
              )}
            </div>
            {/* the architect's check of a finished stage */}
            {p.status === "done" &&
              (p.signed_off_at ? (
                <p className="mt-2 text-sm text-leaf">
                  ✓ Checked and signed off by {p.signed_off_by} · {short(p.signed_off_at.slice(0, 10))}
                  {p.signed_off_note && <span className="text-ink-soft"> · &ldquo;{p.signed_off_note}&rdquo;</span>}
                </p>
              ) : inspects ? (
                <button disabled={busy} onClick={() => act({ op: "signoff", id: p.id })} className="mt-2 rounded-full border border-leaf/50 px-3 py-1 text-xs text-leaf transition hover:bg-leaf/10 disabled:opacity-60">
                  {busy ? "Saving…" : "Sign off this stage"}
                </button>
              ) : (
                <p className="mt-2 text-xs text-ink-soft">Not signed off by the architect yet</p>
              ))}
            {tasks.length > 0 && <TaskList tasks={tasks} site={site} runs={runs} act={act} busy={busy} />}
            {runs &&
              (adding === p.id ? (
                <form
                  className="mt-3 flex flex-wrap gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await act({ op: "task.add", title, phase_id: p.id, due: due || null, crew_id: crew ? Number(crew) : null })) {
                      setTitle("");
                      setDue("");
                      setCrew("");
                      setAdding(null);
                    }
                  }}
                >
                  <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder="What needs doing" aria-label="Task" className={`${input} min-w-0 flex-1`} autoFocus />
                  <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due" className={input} />
                  <select value={crew} onChange={(e) => setCrew(e.target.value)} aria-label="Who" className={input}>
                    <option value="">Anyone</option>
                    {site.crew.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button disabled={busy} className="glow-btn rounded-full px-4 py-1.5 text-sm">
                    Add
                  </button>
                </form>
              ) : (
                <button onClick={() => (tick(), setAdding(p.id))} className="mt-2 text-sm text-accent hover:underline">
                  + Add a task
                </button>
              ))}
          </motion.li>
        );
      })}
    </ol>
  );
}

function CrewPanel({ site, runs, roster, act, today, busy }: { site: Site; runs: boolean; roster: Crew[]; act: Act; today: string; busy: boolean }) {
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("");
  const [phone, setPhone] = useState("");
  const [rate, setRate] = useState("");
  const onSite = new Set(site.crew.map((c) => c.id));
  const here = new Set(site.attendanceToday.filter((a) => a.present).map((a) => a.crew_id));
  const others = roster.filter((c) => !onSite.has(c.id));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="rounded-2xl border border-line bg-paper-raised p-4">
        <p className="font-medium">Crew on this site</p>
        {site.crew.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No one yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {site.crew.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-ink-soft">
                    {c.trade && ` · ${c.trade}`}
                    {c.phone && ` · ${c.phone}`}
                    {!!c.day_rate && ` · ${money(c.day_rate, site.money.currency)} a day`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <button
                    disabled={!runs || busy}
                    onClick={() => act({ op: "attend", crew_id: c.id, day: today, present: !here.has(c.id) }, false).then(() => tick())}
                    className={`rounded-full border px-3 py-1 text-xs ${here.has(c.id) ? "border-leaf bg-leaf/10 text-leaf" : "border-line text-ink-soft"}`}
                  >
                    {here.has(c.id) ? "✓ On site today" : "Not here today"}
                  </button>
                  {runs && (
                    <button onClick={() => act({ op: "crew.remove", crew_id: c.id }, false)} className="text-xs text-ink-soft hover:text-red-600">
                      Remove
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {runs && <p className="mt-3 text-xs text-ink-soft">Labour so far: {money(site.money.labour ?? 0, site.money.currency)}, from the days marked and each person&apos;s day rate.</p>}
      </section>
      {runs && (
        <section className="space-y-3">
          <form
            className="rounded-2xl border border-line bg-paper-raised p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act({ op: "crew.add", name, trade: trade || undefined, phone: phone || undefined, day_rate: Number(rate) || 0 })) {
                setName("");
                setTrade("");
                setPhone("");
                setRate("");
              }
            }}
          >
            <p className="font-medium">Add someone</p>
            <div className="mt-2 grid gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Name" aria-label="Name" className={input} />
              <input value={trade} onChange={(e) => setTrade(e.target.value)} maxLength={40} placeholder="Trade (mason, electrician…)" aria-label="Trade" className={input} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="Phone" aria-label="Phone" className={input} />
              <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder={`Day rate (${site.money.currency})`} aria-label="Day rate" className={input} />
              <button disabled={busy} className="glow-btn rounded-full px-4 py-2 text-sm">
                Add to this site
              </button>
            </div>
          </form>
          {others.length > 0 && (
            <div className="rounded-2xl border border-line bg-paper-raised p-4">
              <p className="font-medium">From your other sites</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {others.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => act({ op: "crew.attach", crew_id: c.id })} className="rounded-full border border-line px-3 py-1 text-sm hover:border-accent hover:text-accent">
                      + {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Materials({ site, runs, act, busy }: { site: Site; runs: boolean; act: Act; busy: boolean }) {
  const [ordering, setOrdering] = useState<number | null>(null);
  const [qty, setQty] = useState("");
  const [supplier, setSupplier] = useState("");
  const [cost, setCost] = useState("");
  const [eta, setEta] = useState("");
  const cur = site.money.currency;
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {site.materials.map((m) => {
          const st = stockOf(m);
          const pct = m.needed ? Math.min(100, (m.used / m.needed) * 100) : 0;
          return (
            <li key={m.id} className="rounded-2xl border border-line bg-paper-raised p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {m.name} <span className="text-sm font-normal text-ink-soft">· {m.needed} {m.unit} needed{!!m.unit_cost && ` · ${money(m.unit_cost, cur)} each`}</span>
                </p>
                <p className="text-sm text-ink-soft">
                  {st.onSite} on site · {st.coming} coming · {m.used} used{st.toOrder > 0 && <span className="text-accent"> · {st.toOrder} to order</span>}
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <motion.div className="h-full bg-leaf" initial={{ width: 0 }} animate={{ width: `${pct}%` }} />
              </div>
              {runs && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-1.5 text-ink-soft">
                    Used
                    <input type="number" min={0} defaultValue={m.used} onBlur={(e) => Number(e.target.value) !== m.used && act({ op: "material.set", id: m.id, used: Number(e.target.value) }, false)} className={`${input} w-24`} aria-label={`${m.name} used`} />
                  </label>
                  {ordering === m.id ? (
                    <form
                      className="flex flex-wrap gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (await act({ op: "order.add", material_id: m.id, qty: Number(qty), supplier: supplier || undefined, cost: Number(cost) || 0, eta: eta || null })) {
                          setOrdering(null);
                          setQty("");
                          setSupplier("");
                          setCost("");
                          setEta("");
                        }
                      }}
                    >
                      <input value={qty} onChange={(e) => setQty(e.target.value)} required inputMode="decimal" placeholder={`How many ${m.unit}`} aria-label="Quantity" className={`${input} w-32`} />
                      <input value={supplier} onChange={(e) => setSupplier(e.target.value)} maxLength={80} placeholder="Supplier" aria-label="Supplier" className={`${input} w-36`} />
                      <input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder={`Cost (${cur})`} aria-label="Cost" className={`${input} w-32`} />
                      <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} aria-label="Arrives" className={input} />
                      <button disabled={busy} className="glow-btn rounded-full px-4 py-1.5">
                        Order
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => {
                        tick();
                        setOrdering(m.id);
                        setQty(String(st.toOrder || ""));
                        setCost(st.toOrder && m.unit_cost ? String(Math.round(st.toOrder * m.unit_cost)) : "");
                      }}
                      className="rounded-full border border-line px-3 py-1 hover:border-accent hover:text-accent"
                    >
                      + Order
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {site.orders.length > 0 && (
        <section className="rounded-2xl border border-line bg-paper-raised p-4">
          <p className="font-medium">Orders</p>
          <ul className="mt-2 divide-y divide-line text-sm">
            {site.orders.map((o) => {
              const m = site.materials.find((x) => x.id === o.material_id);
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {o.qty} {m?.unit} {m?.name}
                    <span className="text-ink-soft">
                      {o.supplier && ` · ${o.supplier}`}
                      {!!o.cost && ` · ${money(o.cost, cur)}`}
                      {o.eta && o.status === "ordered" && ` · arrives ${short(o.eta)}`}
                    </span>
                  </span>
                  {o.status === "delivered" ? (
                    <span className="rounded-full bg-leaf/15 px-2.5 py-0.5 text-xs text-leaf">Delivered</span>
                  ) : runs ? (
                    <button onClick={() => act({ op: "order.deliver", id: o.id })} disabled={busy} className="rounded-full border border-line px-3 py-1 text-xs hover:border-accent hover:text-accent">
                      Mark delivered
                    </button>
                  ) : (
                    <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs text-accent">On its way</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Updates({ projectId, site, runs, act, busy }: { projectId: string; site: Site; runs: boolean; act: Act; busy: boolean }) {
  const [note, setNote] = useState("");
  const [pct, setPct] = useState<string>("");
  const [photos, setPhotos] = useState<{ path: string; name: string; type: string; size: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const phase = site.current;

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setErr(null);
    for (const f of [...files].slice(0, 8 - photos.length)) {
      const form = new FormData();
      form.set("file", f);
      const res = await fetch(`/api/projects/${projectId}/thread/files`, { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setErr(body.error ?? "Upload failed.");
      else setPhotos((x) => [...x, body]);
    }
    setUploading(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      {runs && (
        <form
          className="h-fit rounded-2xl border border-line bg-paper-raised p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act({ op: "update", note, phase_id: phase?.id ?? null, pct: pct === "" ? undefined : Number(pct), photos })) {
              setNote("");
              setPct("");
              setPhotos([]);
            }
          }}
        >
          <p className="font-medium">Post an update</p>
          <p className="text-xs text-ink-soft">Everyone on the project sees it here and in the thread.</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} required maxLength={2000} rows={3} placeholder="What happened on site today" aria-label="Update" className="mt-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
          {phase && (
            <label className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
              {phase.name} is now
              <select value={pct} onChange={(e) => setPct(e.target.value)} className={input} aria-label="Phase progress">
                <option value="">{phase.pct}% (no change)</option>
                {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].filter((n) => n > phase.pct).map((n) => (
                  <option key={n} value={n}>
                    {n === 100 ? "Done" : `${n}%`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {photos.map((f) => (
              <span key={f.path} className="rounded-full border border-line px-2.5 py-1">
                📷 {f.name}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            {/* On a phone this opens the camera. */}
            <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm hover:border-accent hover:text-accent">
              {uploading ? "Uploading…" : "📷 Add photos"}
              <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => void attach(e.target.files)} />
            </label>
            <button disabled={busy || uploading} className="glow-btn rounded-full px-5 py-2 text-sm disabled:opacity-60">
              Post
            </button>
          </div>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </form>
      )}
      <ul className={`space-y-3 ${runs ? "" : "lg:col-span-2"}`}>
        {site.updates.length === 0 && <li className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">No updates yet. Photos and notes from the site show here.</li>}
        {site.updates.map((u) => (
          <motion.li key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-paper-raised p-4">
            <p className="text-xs text-ink-soft">
              {u.author_name} · {new Date(u.created_at).toLocaleString("en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              {u.pct !== null && ` · ${site.phases.find((p) => p.id === u.phase_id)?.name ?? "phase"} ${u.pct}%`}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{u.note}</p>
            {u.photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {u.photos.map((f) =>
                  f.url ? (
                    <a key={f.path} href={f.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt={f.name} className="h-32 w-32 rounded-lg object-cover" />
                    </a>
                  ) : null,
                )}
              </div>
            )}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/** On Overview while building: how far along it is, what's happening now, and the latest photo update. */
export function SiteCard({ projectId, status, onOpen }: { projectId: string; status?: string; onOpen: () => void }) {
  const [site, setSite] = useState<Site | null>(null);
  useEffect(() => {
    fetch(`/api/projects/${projectId}/site?today=${localDay()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.site && setSite(d.site))
      .catch(() => {});
  }, [projectId]);
  if (!site) return null;
  const last = site.updates[0];
  const photo = last?.photos.find((f) => f.url)?.url;
  return (
    <button onClick={() => (tick(), onOpen())} className="mt-4 flex w-full gap-4 rounded-2xl border border-line bg-paper-raised p-5 text-left transition hover:-translate-y-0.5 hover:border-accent">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo && <img src={photo} alt="" className="hidden h-24 w-24 shrink-0 rounded-xl object-cover sm:block" />}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-serif text-2xl">{status === "done" ? "Moved in" : `Building · ${site.overall}%`}</span>
          {site.alerts.length > 0 && <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs text-red-600">{site.alerts.length} to look at</span>}
        </span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-line">
          <motion.span className="block h-full bg-leaf" initial={{ width: 0 }} animate={{ width: `${site.overall}%` }} transition={{ duration: 0.9 }} />
        </span>
        <span className="mt-2 block text-sm text-ink-soft">
          {site.current ? `Now: ${site.current.name} (${site.current.pct}%)` : status === "done" ? "Handed over" : "Built: the handover is next"}
          {last && ` · Latest: "${last.note.slice(0, 80)}${last.note.length > 80 ? "…" : ""}"`}
        </span>
      </span>
    </button>
  );
}

// The architect's visits to the site: what they saw, on the record for everyone on the project.
function Visits({ site, inspects, act, busy }: { site: Site; inspects: boolean; act: Act; busy: boolean }) {
  const [note, setNote] = useState("");
  const visits = site.visits ?? [];
  if (!inspects && !visits.length) return null;
  return (
    <section className="mb-4 rounded-2xl border border-line bg-paper-raised p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">Site visits</p>
      {inspects && (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (note.trim() && (await act({ op: "visit", note: note.trim() }))) setNote("");
          }}
        >
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="What did you see on site today?" aria-label="Visit note" className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-accent" />
          <button disabled={busy || !note.trim()} className="glow-btn rounded-full px-5 py-2 text-sm disabled:opacity-60">
            {busy ? "Saving…" : "Log the visit"}
          </button>
        </form>
      )}
      {visits.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {visits.map((v) => (
            <li key={v.id} className="rounded-xl bg-paper px-3 py-2 text-sm">
              <span className="text-ink-soft">
                {short(v.visited_on)} · {v.author_name}:
              </span>{" "}
              {v.note}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">No visits logged yet. Each one goes in the thread for the client and builder.</p>
      )}
    </section>
  );
}
