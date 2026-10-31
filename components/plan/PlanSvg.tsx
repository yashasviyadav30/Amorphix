import type { MouseEvent, ReactNode } from "react";
import type { Floor, Layout, Opening, Space } from "@/lib/layout/schema";
import { doorIsOpen, wallPieces } from "@/lib/layout/walls";

// An architect-style 2D plan of one floor: walls, door swings, windows, room names and areas.
// Geometry is in metres; the drawing scales to its container.

const PAD = 1.5; // metres of margin around the shell, room for the dimension lines
const WALL = 0.18;

const sqft = (m2: number) => Math.round(m2 * 10.7639);

function Door({ o }: { o: Opening }) {
  // A door leaf drawn open at 90Â°, with its swing arc, hinged at the low end of the opening.
  const w = o.width;
  if (o.axis === "x") {
    const x0 = o.x - w / 2;
    return (
      <g className="stroke-accent" fill="none" strokeWidth={0.05}>
        <line x1={x0} y1={o.y} x2={x0} y2={o.y - w} />
        <path d={`M${x0 + w} ${o.y} A ${w} ${w} 0 0 0 ${x0} ${o.y - w}`} strokeDasharray="0.12 0.08" />
      </g>
    );
  }
  const y0 = o.y - w / 2;
  return (
    <g className="stroke-accent" fill="none" strokeWidth={0.05}>
      <line x1={o.x} y1={y0} x2={o.x + w} y2={y0} />
      <path d={`M${o.x} ${y0 + w} A ${w} ${w} 0 0 0 ${o.x + w} ${y0}`} strokeDasharray="0.12 0.08" />
    </g>
  );
}

function Window({ o }: { o: Opening }) {
  const w = o.width / 2;
  return o.axis === "x" ? (
    <g className="stroke-ink" strokeWidth={0.04}>
      <rect x={o.x - w} y={o.y - WALL / 2} width={o.width} height={WALL} className="fill-paper-raised" />
      <line x1={o.x - w} y1={o.y} x2={o.x + w} y2={o.y} />
    </g>
  ) : (
    <g className="stroke-ink" strokeWidth={0.04}>
      <rect x={o.x - WALL / 2} y={o.y - w} width={WALL} height={o.width} className="fill-paper-raised" />
      <line x1={o.x} y1={o.y - w} x2={o.x} y2={o.y + w} />
    </g>
  );
}

function Room({ s }: { s: Space }) {
  const { x, y, w, h } = s.rect;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} className={s.zone === "circulation" ? "fill-line/40" : "fill-paper-raised"} />
      {s.kind === "stairs" &&
        Array.from({ length: Math.floor((w > h ? w : h) / 0.28) }, (_, i) =>
          w > h ? (
            <line key={i} x1={x + i * 0.28} y1={y} x2={x + i * 0.28} y2={y + h} className="stroke-ink-soft" strokeWidth={0.02} />
          ) : (
            <line key={i} x1={x} y1={y + i * 0.28} x2={x + w} y2={y + i * 0.28} className="stroke-ink-soft" strokeWidth={0.02} />
          ),
        )}
    </g>
  );
}

// Room name and area, sized to fit the room and drawn above walls and doors.
function Label({ s, units }: { s: Space; units: "imperial" | "metric" }) {
  if (s.zone === "circulation") return null;
  const { x, y, w, h } = s.rect;
  const area = w * h;
  const fit = (w * 0.86) / (s.name.length * 0.56); // width an average character needs at size 1
  const size = Math.max(0.2, Math.min(0.5, fit, h / 4));
  return (
    <g>
      <text x={x + w / 2} y={y + h / 2} textAnchor="middle" fontSize={size} className="fill-ink">
        {s.name}
      </text>
      <text x={x + w / 2} y={y + h / 2 + size * 1.3} textAnchor="middle" fontSize={size * 0.8} className="fill-ink-soft">
        {units === "imperial" ? `${sqft(area)} sq ft` : `${area.toFixed(1)} m²`}
      </text>
    </g>
  );
}

// onPick reports a click in plan metres (x across, z down the page); children draw on top in the same units.
export function PlanSvg({
  layout, level = 0, units = "imperial", className = "", onPick, children,
}: { layout: Layout; level?: number; units?: "imperial" | "metric"; className?: string; onPick?: (x: number, z: number) => void; children?: ReactNode }) {
  const floor: Floor | undefined = layout.floors.find((f) => f.level === level) ?? layout.floors[0];
  const { width: W, depth: D } = layout.shell;
  const pieces = wallPieces(floor, layout.shell);
  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${W + PAD * 2} ${D + PAD * 2}`}
      className={className}
      role="img"
      aria-label={`Floor plan, floor ${level + 1}`}
      onClick={
        onPick &&
        ((e: MouseEvent<SVGSVGElement>) => {
          const m = e.currentTarget.getScreenCTM();
          if (!m) return;
          const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
          onPick(pt.x, pt.y);
        })
      }
    >
      {floor.spaces.map((s) => (
        <Room key={s.id} s={s} />
      ))}
      {/* walls from the shared wall model: solid where rooms are closed, dashed where they open into each other */}
      {pieces.map((p, i) => {
        const [x1, y1, x2, y2] = p.axis === "x" ? [p.from, p.at, p.to, p.at] : [p.at, p.from, p.at, p.to];
        return p.open ? (
          <line key={`p-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-ink-soft" strokeWidth={0.03} strokeDasharray="0.15 0.12" />
        ) : (
          <line key={`p-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-ink amorphix-draw" strokeWidth={0.08} pathLength={1} />
        );
      })}
      <rect x={0} y={0} width={W} height={D} fill="none" className="stroke-ink amorphix-draw" strokeWidth={WALL} pathLength={1} />
      {floor.openings.filter((o) => !doorIsOpen(o, pieces)).map((o) =>
        o.type === "door" ? (
          <g key={o.id}>
            <rect
              x={o.axis === "x" ? o.x - o.width / 2 : o.x - WALL}
              y={o.axis === "x" ? o.y - WALL : o.y - o.width / 2}
              width={o.axis === "x" ? o.width : WALL * 2}
              height={o.axis === "x" ? WALL * 2 : o.width}
              className="fill-paper-raised"
            />
            <Door o={o} />
          </g>
        ) : (
          <Window key={o.id} o={o} />
        ),
      )}
      {floor.spaces.map((s) => (
        <Label key={`l-${s.id}`} s={s} units={units} />
      ))}
      {children}
    </svg>
  );
}
