import { labourCost } from "../site/progress.ts";

// A builder's crew across every site: who is where today, how many days each worked this week, and what that
// week has earned them at their day rate. Pure, so the page and the tests agree.

export type CrewMember = { id: number; name: string; trade: string | null; phone: string | null; day_rate: number };
export type Link = { project_id: string; crew_id: number };
export type Attendance = { project_id: string; crew_id: number; day: string; present: boolean; hours: number };
/** `here`: the sites they're marked on today; `marked`: whether anyone marked them at all today (on or off). */
export type CrewLine = CrewMember & { sites: string[]; here: string[]; marked: boolean; days: number; hours: number; earned: number };

const at = (d: string) => new Date(`${d}T00:00:00Z`);

/** The working week `today` falls in, Monday first, as ISO days. */
export function weekOf(today: string): string[] {
  const d = at(today);
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10));
}

export function crewWeek(crew: CrewMember[], links: Link[], attendance: Attendance[], today: string): { lines: CrewLine[]; onSite: number; earned: number } {
  const week = new Set(weekOf(today));
  const lines = crew.map((c) => {
    const mine = attendance.filter((a) => a.crew_id === c.id);
    const thisWeek = mine.filter((a) => week.has(a.day) && a.present);
    const todays = mine.filter((a) => a.day === today);
    return {
      ...c,
      sites: links.filter((l) => l.crew_id === c.id).map((l) => l.project_id),
      here: todays.filter((a) => a.present).map((a) => a.project_id),
      marked: todays.length > 0,
      days: new Set(thisWeek.map((a) => a.day)).size,
      hours: thisWeek.reduce((s, a) => s + Number(a.hours), 0),
      earned: labourCost(thisWeek.map((a) => ({ present: true, hours: Number(a.hours), day_rate: c.day_rate }))),
    };
  });
  // on site today first, then by name
  lines.sort((a, b) => Number(b.here.length > 0) - Number(a.here.length > 0) || a.name.localeCompare(b.name));
  return { lines, onSite: lines.filter((l) => l.here.length).length, earned: lines.reduce((s, l) => s + l.earned, 0) };
}

/**
 * The attendance changes for one tap on a site today: off it if they're there; otherwise onto it, and off any other
 * site they're marked on today, so one worker never draws two days' pay for one day.
 */
export function tapSite(here: string[], site: string): { project_id: string; present: boolean }[] {
  if (here.includes(site)) return [{ project_id: site, present: false }];
  return [...here.map((s) => ({ project_id: s, present: false })), { project_id: site, present: true }];
}
