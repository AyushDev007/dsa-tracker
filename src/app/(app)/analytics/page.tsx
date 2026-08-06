import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserStats, getActivity } from "@/lib/queries";
import { Card, CardHeader, Stat, EmptyState } from "@/components/ui/primitives";
import { AnalyticsCharts } from "@/components/analytics/charts";
import { WeakAreas } from "@/components/analytics/weak-areas";
import { formatDuration } from "@/lib/utils";
import { BarChart3 } from "lucide-react";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const [stats, activity, topicTotals, patternTotals, attempts, progressRows] = await Promise.all([
    getUserStats(userId),
    getActivity(userId, 84), // 12 weeks for the trend chart
    prisma.topic.findMany({
      orderBy: { position: "asc" },
      select: { name: true, slug: true, _count: { select: { problems: true } } },
    }),
    prisma.pattern.findMany({
      orderBy: { position: "asc" },
      select: { name: true, slug: true, _count: { select: { problems: true } } },
    }),
    prisma.attempt.findMany({
      where: { userId },
      select: { durationSec: true, solved: true, usedHint: true, kind: true, createdAt: true },
    }),
    prisma.progress.findMany({
      where: { userId },
      select: {
        status: true,
        confidence: true,
        attemptCount: true,
        usedHint: true,
        timeSpentSec: true,
        problem: {
          select: {
            difficulty: true,
            topic: { select: { name: true, slug: true } },
            pattern: { select: { name: true, slug: true } },
          },
        },
      },
    }),
  ]);

  if (stats.solved === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <Card className="mt-5">
          <EmptyState
            icon={<BarChart3 className="size-8" />}
            title="Nothing to analyse yet"
            description="Solve a handful of problems and this page fills up with coverage by topic and pattern, your weakest areas, and how your solve times are trending."
          />
        </Card>
      </div>
    );
  }

  // ── coverage ──────────────────────────────────────────────────────────────
  const solvedByTopic = new Map(stats.solvedByTopic.map((t) => [t.slug, t.count]));
  const solvedByPattern = new Map(stats.solvedByPattern.map((p) => [p.slug, p.count]));

  const topicCoverage = topicTotals
    .filter((t) => t._count.problems > 0)
    .map((t) => ({
      name: t.name,
      slug: t.slug,
      solved: solvedByTopic.get(t.slug) ?? 0,
      total: t._count.problems,
    }));

  const patternCoverage = patternTotals
    .filter((p) => p._count.problems >= 2)
    .map((p) => ({
      name: p.name,
      slug: p.slug,
      solved: solvedByPattern.get(p.slug) ?? 0,
      total: p._count.problems,
    }));

  // ── solve-time and effort stats ───────────────────────────────────────────
  const timedAttempts = attempts.filter((a) => a.durationSec > 0);
  const median = (xs: number[]) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  };

  const totalTime = progressRows.reduce((sum, r) => sum + r.timeSpentSec, 0);
  const hintRate =
    progressRows.length > 0
      ? Math.round(
          (progressRows.filter((r) => r.usedHint).length / progressRows.length) * 100,
        )
      : 0;
  const firstTryRate = (() => {
    const solved = progressRows.filter((r) => r.status === "SOLVED" && r.attemptCount > 0);
    if (!solved.length) return 0;
    return Math.round((solved.filter((r) => r.attemptCount === 1).length / solved.length) * 100);
  })();

  // ── weekly trend ──────────────────────────────────────────────────────────
  const weekly = (() => {
    const buckets = new Map<string, { week: string; solved: number; revised: number }>();
    for (const a of activity) {
      const d = new Date(a.day);
      // ISO-ish week key: the Monday of that week.
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      const cur = buckets.get(key) ?? { week: key, solved: 0, revised: 0 };
      cur.solved += a.solved;
      cur.revised += a.revised;
      buckets.set(key, cur);
    }
    return [...buckets.values()]
      .sort((a, b) => a.week.localeCompare(b.week))
      .map((b) => ({
        ...b,
        label: new Date(`${b.week}T00:00:00Z`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
      }));
  })();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Where your coverage is thin, and how the effort is trending.
        </p>
      </div>

      <Card className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-5">
        <Stat label="Solved" value={stats.solved} hint={`of ${stats.totalProblems}`} />
        <Stat
          label="Median solve"
          value={median(timedAttempts.map((a) => a.durationSec)) > 0
            ? formatDuration(median(timedAttempts.map((a) => a.durationSec)))
            : "—"}
          hint={`${timedAttempts.length} timed`}
        />
        <Stat label="Total time" value={formatDuration(totalTime)} hint="logged" />
        <Stat
          label="First-try rate"
          value={`${firstTryRate}%`}
          hint="solved in one attempt"
          tone={firstTryRate >= 60 ? "easy" : firstTryRate >= 35 ? "medium" : "hard"}
        />
        <Stat
          label="Hint rate"
          value={`${hintRate}%`}
          hint="needed help"
          tone={hintRate <= 20 ? "easy" : hintRate <= 45 ? "medium" : "hard"}
        />
      </Card>

      <WeakAreas
        topics={topicCoverage}
        patterns={patternCoverage}
        progress={progressRows.map((r) => ({
          status: r.status,
          confidence: r.confidence,
          attemptCount: r.attemptCount,
          usedHint: r.usedHint,
          topic: r.problem.topic,
          pattern: r.problem.pattern,
        }))}
      />

      <AnalyticsCharts
        topics={topicCoverage}
        patterns={patternCoverage}
        weekly={weekly}
        difficulty={(["EASY", "MEDIUM", "HARD"] as const).map((d) => ({
          name: d.charAt(0) + d.slice(1).toLowerCase(),
          solved: stats.solvedByDifficulty[d] ?? 0,
          remaining: (stats.totalByDifficulty[d] ?? 0) - (stats.solvedByDifficulty[d] ?? 0),
        }))}
      />

      <Card>
        <CardHeader
          title="Pattern coverage"
          subtitle="Every pattern in the catalogue, most-covered first"
        />
        <div className="grid gap-x-8 gap-y-2.5 px-5 pb-5 sm:grid-cols-2">
          {[...patternCoverage]
            .sort((a, b) => b.solved / b.total - a.solved / a.total)
            .map((p) => (
              <div key={p.slug} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate text-[0.8125rem] text-[var(--fg-muted)]">
                  {p.name}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${(p.solved / p.total) * 100}%` }}
                  />
                </div>
                <span className="w-11 shrink-0 text-right text-xs text-[var(--fg-subtle)] tabular-nums">
                  {p.solved}/{p.total}
                </span>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
