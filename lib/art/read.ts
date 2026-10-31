// Type-only: this file is shared with the browser, so it must not pull in the Qloo client.
import type { Entity, QlooTag } from "../qloo/api.ts";

// Art and sound for a design (Q10): galleries and museums near the site for the art wall, and artists matched to
// what the client loves for a playlist. Pure helpers; the Qloo calls are in fetch.ts.

const ids = (e: Entity) => (e.tags ?? []).map((t: QlooTag) => t.tag_id ?? t.id ?? "");

/** A real gallery or museum, not a café or bar that hangs pictures (Qloo tags some of those "art gallery"). */
export function isGallery(e: Entity) {
  const t = ids(e);
  const art = t.some((x) => /:(art_gallery|museum|art_museum|art_center)$/.test(x));
  const other = t.some((x) => /:(cafe|coffee_shop|coffee_store|bar|restaurant|night_club|hotel|store)$/.test(x));
  return art && !other;
}

/** Galleries come before museums for an art wall: work there can be bought. */
export const kindOf = (e: Entity): "gallery" | "museum" => (ids(e).some((x) => x.endsWith(":art_gallery")) ? "gallery" : "museum");

/** A search link to hear an artist, with nothing about the client in it. */
export const listenAt = (artist: string) => `https://music.youtube.com/search?q=${encodeURIComponent(artist)}`;

/** The signals for a playlist: the places, films and music they love. Brands pull it off course (a Japanese home
 *  brand gives only Japanese pop), so they count only when nothing else was named. */
export function playlistSignals(signals: { entityId: string; type?: string }[]) {
  const own = signals.filter((s) => s.type !== "urn:entity:brand").map((s) => s.entityId);
  return own.length ? own : signals.map((s) => s.entityId);
}
