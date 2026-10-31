import { seeds, SIZE } from "@/lib/brand/seeds";

const SEEDS = seeds();

// The seed mark alone. Colours follow the theme: ink seeds, accent-coloured accents.
export function Mark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`} className={className} role="img" aria-label="Amorphix">
      {SEEDS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} className={s.accent ? "fill-accent" : "fill-ink"} />
      ))}
    </svg>
  );
}

// Mark and wordmark together, for headers.
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark size={size} />
      <span className="font-serif leading-none text-ink" style={{ fontSize: size * 0.95 }}>
        Amorphix
      </span>
    </span>
  );
}
