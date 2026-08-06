"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingDown, ArrowRight, ThumbsUp } from "lucide-react";

type Coverage = { name: string; slug: string; solved: number; total: number };

type ProgressRow = {
  status: string;
  confidence: number | null;
  attemptCount: number;
  usedHint: boolean;
  topic: { name: string; slug: string };
  pattern: { name: string; slug: string };
};

/**
 * Weak-area detection.
 *
 * Coverage alone is a bad signal — a pattern you've never touched isn't a
 * weakness, it's just unstarted. So each area gets two independent scores:
 *
 *   struggle — of the problems you *did* attempt here, how many went badly
 *              (rated "struggled", needed a hint, or took 3+ attempts)
 *   gap      — how much of the area you haven't touched at all
 *
 * A struggle score only counts once you've attempted at least three problems in
 * the area, so one bad day doesn't brand a whole topic as weak.
 */
const MIN_SAMPLE = 3;

function analyse(rows: ProgressRow[], coverage: Coverage[], key: "topic" | "pattern") {
  const byArea = new Map<string, ProgressRow[]>();
  for (const r of rows) {
    const slug = r[key].slug;
    if (!byArea.has(slug)) byArea.set(slug, []);
    byArea.get(slug)!.push(r);
  }

  return coverage
    .map((area) => {
      const attempted = (byArea.get(area.slug) ?? []).filter((r) => r.status !== "TODO");
      const rough = attempted.filter(
        (r) => r.confidence === 1 || r.usedHint || r.attemptCount >= 3,
      ).length;

      const struggle = attempted.length >= MIN_SAMPLE ? rough / attempted.length : null;
      const gap = area.total > 0 ? 1 - area.solved / area.total : 0;

      return { ...area, attempted: attempted.length, rough, struggle, gap };
    })
    .filter((a) => a.total > 0);
}

export function WeakAreas({
  topics,
  patterns,
  progress,
}: {
  topics: Coverage[];
  patterns: Coverage[];
  progress: ProgressRow[];
}) {
  const { struggling, untouched, strong } = useMemo(() => {
    const all = [
      ...analyse(progress, topics, "topic").map((a) => ({ ...a, kind: "topic" as const })),
      ...analyse(progress, patterns, "pattern").map((a) => ({ ...a, kind: "pattern" as const })),
    ];

    const struggling = all
      .filter((a) => a.struggle !== null && a.struggle >= 0.4)
      .sort((a, b) => (b.struggle ?? 0) - (a.struggle ?? 0))
      .slice(0, 6);

    const untouched = all
      .filter((a) => a.attempted === 0 && a.total >= 3)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const strong = all
      .filter((a) => a.struggle !== null && a.struggle <= 0.15 && a.attempted >= MIN_SAMPLE)
      .sort((a, b) => (a.struggle ?? 1) - (b.struggle ?? 1))
      .slice(0, 5);

    return { struggling, untouched, strong };
  }, [topics, patterns, progress]);

  const href = (kind: "topic" | "pattern", slug: string) => `/problems?${kind}=${slug}`;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title="Where you're struggling"
          subtitle="Areas where a rating of “struggled”, a hint, or 3+ attempts came up often"
        />
        {struggling.length === 0 ? (
          <EmptyState
            icon={<ThumbsUp className="size-7" />}
            title="No weak areas detected"
            description={`Nothing has enough rough solves to flag yet — it takes ${MIN_SAMPLE} attempted problems in an area before this fires.`}
          />
        ) : (
          <ul className="border-t border-[var(--border)]">
            {struggling.map((a) => (
              <li key={`${a.kind}-${a.slug}`} className="border-b border-[var(--border)] last:border-0">
                <Link
                  href={href(a.kind, a.slug)}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      (a.struggle ?? 0) >= 0.6
                        ? "bg-[var(--hard-soft)] text-[var(--hard)]"
                        : "bg-[var(--medium-soft)] text-[var(--medium)]",
                    )}
                  >
                    <AlertTriangle className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <p className="text-[0.6875rem] text-[var(--fg-subtle)]">
                      {a.rough} of {a.attempted} attempted went badly · {a.solved}/{a.total} solved
                    </p>
                  </div>
                  <Badge tone={(a.struggle ?? 0) >= 0.6 ? "hard" : "medium"}>
                    {Math.round((a.struggle ?? 0) * 100)}% rough
                  </Badge>
                  <ArrowRight className="size-3.5 shrink-0 text-[var(--fg-subtle)]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Biggest gaps" subtitle="Not started at all" />
          {untouched.length === 0 ? (
            <div className="px-5 pb-5">
              <p className="text-[0.8125rem] text-[var(--fg-subtle)]">
                You&apos;ve touched every area. Nice.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5 px-5 pb-5">
              {untouched.map((a) => (
                <li key={`${a.kind}-${a.slug}`}>
                  <Link
                    href={href(a.kind, a.slug)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[0.8125rem] transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <TrendingDown className="size-3.5 shrink-0 text-[var(--fg-subtle)]" />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-[0.6875rem] text-[var(--fg-subtle)] tabular-nums">
                      {a.total}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {strong.length > 0 && (
          <Card>
            <CardHeader title="Solid ground" subtitle="Clean solves, rarely stuck" />
            <div className="flex flex-wrap gap-1.5 px-5 pb-5">
              {strong.map((a) => (
                <Badge key={`${a.kind}-${a.slug}`} tone="easy">
                  {a.name}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
