// The Amorphix mark: sunflower seeds placed at the golden angle (phyllotaxis).
// Seed n sits at angle n × 137.508° and radius c·√n, so the pattern packs evenly with no gaps.

export const GOLDEN_ANGLE_DEG = 137.508;
export const SIZE = 60; // viewBox side

export type Seed = { x: number; y: number; r: number; accent: boolean };

export function seeds(count = 70, spacing = 3.25): Seed[] {
  const out: Seed[] = [];
  for (let n = 1; n <= count; n++) {
    const radius = spacing * Math.sqrt(n);
    const angle = (n * GOLDEN_ANGLE_DEG * Math.PI) / 180;
    out.push({
      x: +(SIZE / 2 + radius * Math.cos(angle)).toFixed(2),
      y: +(SIZE / 2 + radius * Math.sin(angle)).toFixed(2),
      r: +(0.9 + 1.7 * (n / count)).toFixed(2), // seeds grow toward the rim
      accent: n % 8 === 0, // every eighth seed in the accent colour
    });
  }
  return out;
}

// A standalone SVG string, for the favicon and anywhere React isn't available.
export function seedsSvg({ ink, accent, background }: { ink: string; accent: string; background?: string }) {
  const bg = background ? `<rect width="${SIZE}" height="${SIZE}" rx="13" fill="${background}"/>` : "";
  const dots = seeds()
    .map((s) => `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${s.accent ? accent : ink}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">${bg}${dots}</svg>`;
}
