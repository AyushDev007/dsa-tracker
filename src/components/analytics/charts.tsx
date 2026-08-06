"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Colour policy for this file
 * ───────────────────────────
 * Two series (new solves vs revisions) use categorical slots 1 and 2 —
 * blue/orange — which clear the CVD, normal-vision, lightness and contrast
 * gates in both light and dark mode.
 *
 * Difficulty is deliberately NOT a categorical palette: green/amber/red fails
 * CVD separation (red↔green ΔE 4.1 under deuteranopia). It's rendered as three
 * separately labelled rows instead, so position and text carry the identity and
 * the familiar LeetCode colours are only reinforcement.
 */
const SERIES = {
  solved: { light: "#2a78d6", dark: "#3987e5", label: "New solves" },
  revised: { light: "#eb6834", dark: "#d95926", label: "Revisions" },
} as const;

type Coverage = { name: string; slug: string; solved: number; total: number };

export function AnalyticsCharts({
  topics,
  patterns: _patterns,
  weekly,
  difficulty,
}: {
  topics: Coverage[];
  patterns: Coverage[];
  weekly: { week: string; label: string; solved: number; revised: number }[];
  difficulty: { name: string; solved: number; remaining: number }[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <WeeklyTrend data={weekly} />
      <DifficultyBreakdown data={difficulty} />
      <TopicCoverage data={topics} className="lg:col-span-2" />
    </div>
  );
}

/* ───────────────────────────────────────────────────────── weekly trend ─── */

function WeeklyTrend({
  data,
}: {
  data: { week: string; label: string; solved: number; revised: number }[];
}) {
  const hasData = data.some((d) => d.solved > 0 || d.revised > 0);

  return (
    <Card>
      <CardHeader
        title="Solves per week"
        subtitle="Last 12 weeks — new problems against revisions"
        action={
          <div className="flex items-center gap-3">
            <LegendSwatch color={SERIES.solved} label={SERIES.solved.label} />
            <LegendSwatch color={SERIES.revised} label={SERIES.revised.label} />
          </div>
        }
      />
      <div className="h-56 px-2 pb-4">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-[0.8125rem] text-[var(--fg-subtle)]">
            No activity in the last 12 weeks.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="fillSolved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-solved)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--series-solved)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="fillRevised" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-revised)" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="var(--series-revised)" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="2 4"
                vertical={false}
                stroke="var(--border)"
                strokeOpacity={0.9}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--fg-subtle)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "var(--fg-subtle)" }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ stroke: "var(--fg-subtle)", strokeWidth: 1, strokeDasharray: "3 3" }}
                content={<TrendTooltip />}
              />
              <Area
                type="monotone"
                dataKey="solved"
                name={SERIES.solved.label}
                stroke="var(--series-solved)"
                strokeWidth={2}
                fill="url(#fillSolved)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
              />
              <Area
                type="monotone"
                dataKey="revised"
                name={SERIES.revised.label}
                stroke="var(--series-revised)"
                strokeWidth={2}
                fill="url(#fillRevised)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <SeriesVars />
    </Card>
  );
}

type TooltipPayload = { name?: string; value?: number; dataKey?: string }[];

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">Week of {label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="mt-0.5 flex items-center gap-1.5 text-[var(--fg-muted)]">
          <span
            className="size-2 rounded-full"
            style={{
              background:
                p.dataKey === "solved" ? "var(--series-solved)" : "var(--series-revised)",
            }}
          />
          {p.name}: <span className="font-semibold tabular-nums text-[var(--fg)]">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function LegendSwatch({
  color,
  label,
}: {
  color: { light: string; dark: string };
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[0.6875rem] text-[var(--fg-muted)]">
      <span
        className="h-0.5 w-4 rounded-full"
        style={{ background: label === SERIES.solved.label ? color.light : color.light }}
      />
      {label}
    </span>
  );
}

/** Series hexes as CSS variables so light and dark each get their own step. */
function SeriesVars() {
  return (
    <style>{`
      .dark { --series-solved: ${SERIES.solved.dark}; --series-revised: ${SERIES.revised.dark}; }
      :root { --series-solved: ${SERIES.solved.light}; --series-revised: ${SERIES.revised.light}; }
    `}</style>
  );
}

/* ─────────────────────────────────────────────────── difficulty rows ────── */

function DifficultyBreakdown({
  data,
}: {
  data: { name: string; solved: number; remaining: number }[];
}) {
  const tone = { Easy: "easy", Medium: "medium", Hard: "hard" } as const;

  return (
    <Card>
      <CardHeader title="By difficulty" subtitle="Solved against what's available" />
      <div className="space-y-4 px-5 pb-5">
        {data.map((d) => {
          const total = d.solved + d.remaining;
          const pct = total > 0 ? (d.solved / total) * 100 : 0;
          const key = tone[d.name as keyof typeof tone] ?? "accent";

          return (
            <div key={d.name}>
              <div className="flex items-baseline justify-between">
                <span className={cn("text-[0.8125rem] font-medium", `text-[var(--${key})]`)}>
                  {d.name}
                </span>
                <span className="text-xs text-[var(--fg-muted)] tabular-nums">
                  <span className="font-semibold text-[var(--fg)]">{d.solved}</span> / {total}
                  <span className="ml-2 text-[var(--fg-subtle)]">{Math.round(pct)}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${pct}%`, background: `var(--${key})` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────── topic coverage ─── */

function TopicCoverage({ data, className }: { data: Coverage[]; className?: string }) {
  const [sort, setSort] = useState<"progress" | "gap" | "size">("progress");

  const sorted = useMemo(() => {
    const list = [...data];
    if (sort === "progress") list.sort((a, b) => b.solved / b.total - a.solved / a.total);
    if (sort === "gap") list.sort((a, b) => b.total - b.solved - (a.total - a.solved));
    if (sort === "size") list.sort((a, b) => b.total - a.total);
    return list;
  }, [data, sort]);

  const max = Math.max(1, ...data.map((d) => d.total));

  return (
    <Card className={className}>
      <CardHeader
        title="Coverage by topic"
        subtitle="Filled portion is solved; the track is everything in that topic"
        action={
          <div className="flex gap-0.5 rounded-lg border border-[var(--border)] p-0.5">
            {(["progress", "gap", "size"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cn(
                  "rounded-md px-2 py-1 text-[0.6875rem] font-medium capitalize transition-colors",
                  sort === s
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
                )}
              >
                {s === "gap" ? "most left" : s === "size" ? "largest" : "furthest"}
              </button>
            ))}
          </div>
        }
      />
      <div className="space-y-1.5 px-5 pb-5">
        {sorted.map((t) => {
          const trackWidth = (t.total / max) * 100;
          const fill = t.total > 0 ? (t.solved / t.total) * 100 : 0;
          return (
            <div key={t.slug} className="group flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-[0.8125rem] text-[var(--fg-muted)]">
                {t.name}
              </span>
              <div className="flex-1">
                <div
                  className="h-4 overflow-hidden rounded-[4px] bg-[var(--surface-2)] transition-[width]"
                  style={{ width: `${trackWidth}%` }}
                  title={`${t.solved} of ${t.total} solved`}
                >
                  <div
                    className="h-full rounded-[4px] bg-[var(--accent)] transition-[width] duration-700 ease-out"
                    style={{ width: `${fill}%` }}
                  />
                </div>
              </div>
              <span className="w-14 shrink-0 text-right text-xs text-[var(--fg-subtle)] tabular-nums">
                {t.solved}/{t.total}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
