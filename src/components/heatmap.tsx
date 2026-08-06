"use client";

import { useMemo, useState } from "react";
import type { DayCount } from "@/lib/streaks";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["", "Mon", "", "Wed", "", "Fri", ""];

/** Four buckets, scaled to the user's own busiest day so it reads well at any volume. */
function levelFor(count: number, max: number) {
  if (count <= 0) return 0;
  if (max <= 4) return Math.min(count, 4);
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function Heatmap({ series }: { series: DayCount[] }) {
  const [hover, setHover] = useState<{ day: DayCount; x: number; y: number } | null>(null);

  const { weeks, monthLabels, max } = useMemo(() => {
    const max = Math.max(1, ...series.map((d) => d.count));

    // Pad the front so the first column starts on a Sunday.
    const first = new Date(`${series[0]?.date ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    const padding = first.getUTCDay();
    const cells: (DayCount | null)[] = [...Array(padding).fill(null), ...series];

    const weeks: (DayCount | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    // One label per month, positioned at the week its 1st falls in.
    const monthLabels: { index: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, i) => {
      const firstReal = week.find(Boolean);
      if (!firstReal) return;
      const m = new Date(`${firstReal.date}T00:00:00Z`).getUTCMonth();
      if (m !== lastMonth) {
        monthLabels.push({ index: i, label: MONTHS[m] });
        lastMonth = m;
      }
    });

    return { weeks, monthLabels, max };
  }, [series]);

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex min-w-full flex-col gap-1">
          {/* month row */}
          <div className="flex gap-[3px] pl-8">
            {weeks.map((_, i) => {
              const label = monthLabels.find((m) => m.index === i);
              return (
                <div key={i} className="w-[11px] shrink-0">
                  {label && (
                    <span className="text-[0.625rem] whitespace-nowrap text-[var(--fg-subtle)]">
                      {label.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-[3px]">
            {/* weekday gutter */}
            <div className="flex w-8 shrink-0 flex-col gap-[3px] pr-1">
              {WEEKDAYS.map((d, i) => (
                <div
                  key={i}
                  className="flex h-[11px] items-center justify-end text-[0.5625rem] text-[var(--fg-subtle)]"
                >
                  {d}
                </div>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} className="flex shrink-0 flex-col gap-[3px]">
                {Array.from({ length: 7 }, (_, di) => {
                  const day = week[di];
                  if (!day) return <div key={di} className="size-[11px]" />;
                  const level = levelFor(day.count, max);
                  return (
                    <div
                      key={di}
                      className={cn(
                        "size-[11px] cursor-pointer rounded-[2.5px] transition-transform hover:scale-125",
                        "ring-offset-1 ring-offset-[var(--surface)] hover:ring-1 hover:ring-[var(--fg-subtle)]",
                      )}
                      style={{ background: `var(--heat-${level})` }}
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setHover({ day, x: r.left + r.width / 2, y: r.top });
                      }}
                      onMouseLeave={() => setHover(null)}
                      role="gridcell"
                      aria-label={`${day.count} on ${day.date}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1.5 text-[0.625rem] text-[var(--fg-subtle)]">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <div
            key={l}
            className="size-[11px] rounded-[2.5px]"
            style={{ background: `var(--heat-${l})` }}
          />
        ))}
        <span>More</span>
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: hover.x, top: hover.y }}
        >
          <p className="font-medium tabular-nums">
            {hover.day.count === 0
              ? "No activity"
              : `${hover.day.count} ${hover.day.count === 1 ? "submission" : "submissions"}`}
          </p>
          <p className="text-[0.6875rem] text-[var(--fg-muted)]">
            {new Date(`${hover.day.date}T00:00:00Z`).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
          </p>
          {hover.day.revised > 0 && (
            <p className="text-[0.6875rem] text-[var(--accent)]">
              {hover.day.revised} revision{hover.day.revised === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
