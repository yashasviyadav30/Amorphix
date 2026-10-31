import type { Layout } from "@/lib/layout/schema";
import { sayLength, schedule, type Elevation } from "@/lib/export/drawings";

// Architect-style drawings that sit beside the plan: an elevation of one side of the building, and the overall
// dimensions and door and window tags drawn over a plan. All in metres; each drawing scales to its container.

const PAD = 1.4;
type Units = "imperial" | "metric";

/** One side of the building from outside: walls, roof, floor lines, every door and window with its tag, levels and width. */
export function ElevationSvg({ e, units, className = "" }: { e: Elevation; units: Units; className?: string }) {
  const H = e.high;
  const pts = (p: [number, number][]) => p.map(([t, y]) => `${t},${Y(y)}`).join(" ");
  const Y = (y: number) => H - y; // SVG runs down, buildings go up
  const level = (y: number) => (units === "metric" ? `+${y.toFixed(2)}` : `+${sayLength(y, units)}`);
  return (
    <svg viewBox={`${-PAD} ${-PAD * 0.6} ${e.length + PAD * 2.6} ${H + PAD * 1.8}`} className={className} role="img" aria-label={`Elevation, ${e.side}`}>
      <line x1={-PAD} y1={Y(0)} x2={e.length + 0.12} y2={Y(0)} className="stroke-ink" strokeWidth={0.06} />
      <rect x={0} y={Y(e.top)} width={e.length} height={e.top} className="fill-paper-raised stroke-ink" strokeWidth={0.06} />
      {e.infill && <polygon points={pts(e.infill)} className="fill-paper-raised stroke-ink" strokeWidth={0.06} />}
      <polygon points={pts(e.roof)} className="fill-ink-soft stroke-ink" strokeWidth={0.03} />
      {e.floors
        .filter((f) => f > 0)
        .map((f) => (
          <line key={f} x1={0} y1={Y(f)} x2={e.length} y2={Y(f)} className="stroke-ink-soft" strokeWidth={0.025} strokeDasharray="0.15 0.1" />
        ))}
      {e.openings.map((o) => (
        <g key={o.tag}>
          <rect x={o.t0} y={Y(o.y1)} width={o.t1 - o.t0} height={o.y1 - o.y0} className={o.type === "window" ? "fill-accent/15 stroke-ink" : "fill-paper stroke-ink"} strokeWidth={0.035} />
          {o.type === "window" ? (
            <line x1={(o.t0 + o.t1) / 2} y1={Y(o.y1)} x2={(o.t0 + o.t1) / 2} y2={Y(o.y0)} className="stroke-ink" strokeWidth={0.02} />
          ) : (
            <circle cx={o.t1 - 0.12} cy={Y(o.y0 + 1)} r={0.035} className="fill-ink" />
          )}
          <text x={(o.t0 + o.t1) / 2} y={Y(o.y1) - 0.12} textAnchor="middle" fontSize={0.22} className="fill-accent font-mono">
            {o.tag}
          </text>
        </g>
      ))}
      {/* levels on the right, the width underneath */}
      {[...e.floors, e.top, ...(e.high - e.top > 0.5 ? [e.high] : [])].map((y) => (
        <g key={`lv-${y}`}>
          <line x1={e.length + 0.15} y1={Y(y)} x2={e.length + 0.55} y2={Y(y)} className="stroke-ink" strokeWidth={0.02} />
          <text x={e.length + 0.65} y={Y(y) + 0.08} fontSize={0.22} className="fill-ink font-mono">
            {level(y)}
          </text>
        </g>
      ))}
      <Dim x1={0} y1={Y(0) + 0.6} x2={e.length} y2={Y(0) + 0.6} label={sayLength(e.length, units)} />
    </svg>
  );
}

/** A dimension line with end ticks and its length written along it. */
function Dim({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label: string }) {
  const across = x1 === x2;
  const tick = (x: number, y: number) => (across ? <line x1={x - 0.12} y1={y} x2={x + 0.12} y2={y} /> : <line x1={x} y1={y - 0.12} x2={x} y2={y + 0.12} />);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g className="stroke-ink" strokeWidth={0.02}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {tick(x1, y1)}
      {tick(x2, y2)}
      <text
        x={across ? mx - 0.15 : mx}
        y={across ? my : my - 0.15}
        textAnchor="middle"
        fontSize={0.24}
        transform={across ? `rotate(-90 ${mx - 0.15} ${my})` : undefined}
        className="fill-ink stroke-none font-mono"
      >
        {label}
      </text>
    </g>
  );
}

/** Drawn over a PlanSvg: the building's overall width and depth, and each door and window's schedule tag. */
export function PlanMarks({ layout, level, units }: { layout: Layout; level: number; units: Units }) {
  const { width: W, depth: D } = layout.shell;
  const { doors, windows } = schedule(layout);
  const floor = layout.floors.find((f) => f.level === level);
  const at = new Map((floor?.openings ?? []).map((o) => [o.id, o]));
  return (
    <g>
      <Dim x1={0} y1={-0.85} x2={W} y2={-0.85} label={sayLength(W, units)} />
      <Dim x1={-0.95} y1={0} x2={-0.95} y2={D} label={sayLength(D, units)} />
      {[...doors, ...windows]
        .filter((t) => t.level === level && at.has(t.id))
        .map((t) => {
          const o = at.get(t.id)!;
          // Outside openings get their tag outside the wall; inside doors beside the opening, clear of room names.
          const out = o.between.includes("outside");
          const [x, y, anchor]: [number, number, "middle" | "start" | "end"] =
            o.axis === "x"
              ? [o.x, out && o.y > D / 2 ? o.y + 0.42 : o.y - 0.25, "middle"]
              : out && o.x > W / 2
                ? [o.x + 0.18, o.y + 0.07, "start"]
                : [o.x - 0.18, o.y + 0.07, "end"];
          return (
            <text key={t.tag} x={x} y={y} fontSize={0.2} textAnchor={anchor} className={`${t.type === "door" ? "fill-accent" : "fill-ink-soft"} font-mono`}>
              {t.tag}
            </text>
          );
        })}
    </g>
  );
}
