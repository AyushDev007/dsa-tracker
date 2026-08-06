import { isoDay } from "@/lib/utils";

export type DayCount = { date: string; count: number; solved: number; revised: number };

/**
 * Build a dense day-by-day series for the heatmap.
 *
 * Merges two sources: our own ActivityDay rows (what you did *in the tracker*)
 * and LeetCode's submission calendar (what you did *on LeetCode*). A day counts
 * as active if either source saw something, and the displayed count is the
 * larger of the two rather than the sum — solving a problem in both places is
 * one day's work, not two.
 */
export function buildHeatmap(
  activity: { day: Date; solved: number; revised: number; minutes: number }[],
  leetcodeCalendar: Record<string, number> = {},
  days = 365,
): DayCount[] {
  const local = new Map(
    activity.map((a) => [
      isoDay(a.day),
      { solved: a.solved, revised: a.revised, minutes: a.minutes },
    ]),
  );

  const out: DayCount[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);

    const mine = local.get(key);
    // A day spent attempting without solving is still a day you showed up, so
    // it lights the cell — otherwise the hardest sessions leave no trace.
    const solvesAndRevisions = (mine?.solved ?? 0) + (mine?.revised ?? 0);
    const localCount = solvesAndRevisions || ((mine?.minutes ?? 0) > 0 ? 1 : 0);
    const lc = leetcodeCalendar[key] ?? 0;

    out.push({
      date: key,
      count: Math.max(localCount, lc),
      solved: mine?.solved ?? 0,
      revised: mine?.revised ?? 0,
    });
  }

  return out;
}

/**
 * Current and longest streak.
 *
 * "Current" tolerates today being empty — a streak shouldn't read as broken at
 * 9am just because you haven't started yet. It only breaks once yesterday is
 * also empty.
 */
export function computeStreaks(series: DayCount[]) {
  let longest = 0;
  let run = 0;
  for (const d of series) {
    if (d.count > 0) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  let current = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    const isToday = i === series.length - 1;
    if (series[i].count > 0) current++;
    else if (isToday) continue; // today not started yet — don't break the streak
    else break;
  }

  const active = series.filter((d) => d.count > 0).length;
  const total = series.reduce((sum, d) => sum + d.count, 0);

  return { current, longest, activeDays: active, totalInPeriod: total };
}

export function todayCount(series: DayCount[]) {
  return series[series.length - 1]?.count ?? 0;
}
