import type { Sketch } from "@/lib/home/sketch";

// A design's ground floor, drawn line by line as the card appears: the outline first, then each room. Plain SVG and
// CSS, so it costs nothing on a phone. Without a design yet, a dashed empty plot.
export function PlanSketch({ sketch, className = "", labels = false }: { sketch: Sketch | null; className?: string; labels?: boolean }) {
  if (!sketch) {
    return (
      <svg viewBox="0 0 100 70" className={className} aria-hidden>
        <rect x="4" y="4" width="92" height="62" rx="2" fill="none" stroke="var(--line)" strokeDasharray="3 3" />
        <text x="50" y="38" textAnchor="middle" className="fill-ink-soft font-mono" fontSize="5">no plan yet</text>
      </svg>
    );
  }
  const pad = Math.max(sketch.w, sketch.d) * 0.06;
  const big = Math.max(sketch.w, sketch.d);
  return (
    <svg viewBox={`${-pad} ${-pad} ${sketch.w + pad * 2} ${sketch.d + pad * 2}`} className={`sketch-draw ${className}`} role="img" aria-label={`Plan, ${sketch.rooms.filter((r) => r.name).length} rooms`}>
      {sketch.rooms.map((r, i) => (
        <g key={i} style={{ ["--i" as string]: i + 1 }}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} pathLength={1} fill={r.name ? "color-mix(in srgb, var(--accent) 5%, transparent)" : "transparent"} stroke="var(--accent)" strokeOpacity={0.6} strokeWidth={big / 160} />
          {labels && r.name && r.w > (big / 32) * 0.55 * r.name.length + big / 40 && r.h > big / 12 && (
            <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={big / 32} className="sketch-label fill-ink-soft">
              {r.name}
            </text>
          )}
        </g>
      ))}
      <rect x={0} y={0} width={sketch.w} height={sketch.d} pathLength={1} fill="none" stroke="var(--ink)" strokeWidth={big / 90} className="sketch-shell" />
    </svg>
  );
}
