// The processing screen's terminal log, written from the project's real data: what the user said,
// what Amorphix matched, what Amorphix is about to build. Nothing here is decoration text.

type Source = {
  space_type: string | null;
  site: { width?: number; depth?: number; floors?: number; location?: string };
  interview: Record<string, unknown>;
  taste_signals: { name: string; layer: 1 | 2 | 3 }[];
  taste: { tags: { family: string; value: string; sources: { name: string }[] }[]; brands: { name: string }[] } | null;
};

const LAYER = { 1: "place", 2: "brand", 3: "culture" } as const;
const words = (v: string) => v.replaceAll("_", " ");

export function processingLog(p: Source): string[] {
  const lines: string[] = [];
  const s = p.site;
  lines.push(`> load project · ${p.space_type ?? "space"} · ${s.location ?? "location unknown"}`);
  if (s.width && s.depth) lines.push(`> site ${s.width.toFixed(1)} × ${s.depth.toFixed(1)} m · ${s.floors ?? 1} floor${(s.floors ?? 1) > 1 ? "s" : ""}`);
  // Markers the app keeps for itself aren't answers.
  const sections = Object.keys(p.interview).filter((k) => k !== "scripted" && k !== "language");
  if (sections.length) lines.push(`> interview parsed · ${sections.join(", ")}`);

  for (const sig of p.taste_signals.slice(0, 6)) {
    const tags = (p.taste?.tags ?? []).filter((t) => t.sources.some((x) => x.name === sig.name)).slice(0, 3);
    const found = tags.map((t) => `${t.family}: ${words(t.value)}`).join(", ");
    lines.push(`> taste graph · ${LAYER[sig.layer]} · ${sig.name}${found ? ` → ${found}` : ""}`);
  }
  const top = (p.taste?.tags ?? []).slice(0, 4).map((t) => words(t.value));
  if (top.length) lines.push(`> style vector · ${top.join(" · ")}`);
  const brands = (p.taste?.brands ?? []).slice(0, 3).map((b) => b.name);
  if (brands.length) lines.push(`> matched brands · ${brands.join(", ")}`);
  lines.push("> writing design brief…", "> generating room program…", "> laying out 3 plans · validating walls, doors, light…");
  return lines;
}
