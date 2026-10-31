// The command box's search: an item matches when every typed word is in its name or hint, in any order; names
// that start with the first word come first.
export type PaletteItem = { label: string; hint: string; href: string; group: string };

export function matches<T extends PaletteItem>(items: T[], q: string): T[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items
    .filter((it) => words.every((w) => `${it.label} ${it.hint}`.toLowerCase().includes(w)))
    .sort((a, b) => Number(!a.label.toLowerCase().startsWith(words[0])) - Number(!b.label.toLowerCase().startsWith(words[0])));
}
