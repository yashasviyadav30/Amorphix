import type { Signal } from "./engine.ts";
import type { Profile } from "./types.ts";

// The browser's way to a profile: the server's (YugabyteDB vector search), or the same engine on the device if the
// server can't be reached.
export async function profileOf(signals: Signal[], take = 12): Promise<Profile> {
  try {
    const res = await fetch("/api/taste/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signals, take }) });
    if (res.ok) return ((await res.json()) as { profile: Profile }).profile;
  } catch {}
  const [{ buildProfile }, vectors] = await Promise.all([import("./engine.ts"), import("./vectors.json")]);
  return buildProfile(signals, vectors.default.words as never, vectors.default.brands, take);
}
