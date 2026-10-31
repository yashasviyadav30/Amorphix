import type { Profile } from "./types.ts";

// A style's name from its strongest decor words: "Japandi", or "Industrial meets Minimalist" when a second look is
// nearly as strong. Falls back to the strongest word of any kind, then to "Your own style".
const title = (v: string) =>
  v
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace("Mid Century", "Mid-Century");

export function styleName(p: Profile): string {
  const decor = p.tags.filter((t) => t.family === "decor");
  if (decor.length >= 2 && decor[1].weight >= decor[0].weight * 0.8) return `${title(decor[0].value)} meets ${title(decor[1].value)}`;
  if (decor[0]) return title(decor[0].value);
  return p.tags[0] ? title(p.tags[0].value) : "Your own style";
}
