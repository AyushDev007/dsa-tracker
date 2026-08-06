import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserStats, getActivity } from "@/lib/queries";
import { buildHeatmap, computeStreaks, todayCount } from "@/lib/streaks";
import { Heatmap } from "@/components/heatmap";
import { GoalRing } from "@/components/goal-ring";
import { Card, CardHeader, Badge, Button, ProgressBar, EmptyState } from "@/components/ui/primitives";
import { DifficultyBadge } from "@/components/ui/primitives";
import { cn, percent, relativeTime } from "@/lib/utils";
import { Flame, RotateCcw, Trophy, Target, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const [stats, activity, lcSync, dueSoon, recent, user] = await Promise.all([
    getUserStats(userId),
    getActivity(userId, 365),
    prisma.leetcodeSync.findUnique({ where: { userId } }),
    prisma.progress.findMany({
      where: { userId, status: "SOLVED", nextReviewAt: { lte: new Date() } },
      orderBy: { nextReviewAt: "asc" },
      take: 5,
      include: { problem: { select: { title: true, slug: true, difficulty: true } } },
    }),
    prisma.progress.findMany({
      where: { userId, status: "SOLVED" },
      orderBy: { solvedAt: "desc" },
      take: 6,
      include: {
        problem: {
          select: { title: true, slug: true, difficulty: true, topic: { select: { name: true } } },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { dailyGoal: true, name: true } }),
  ]);

  const calendar = (lcSync?.calendar as Record<string, number> | null) ?? {};
  const series = buildHeatmap(activity, calendar, 365);
  const streaks = computeStreaks(series);
  const today = todayCount(series);
  const goal = user?.dailyGoal ?? 3;

  const firstName = (user?.name ?? "there").split(" ")[0];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {today >= goal
              ? `Daily goal hit — ${today} today. Anything else is bonus.`
              : today > 0
                ? `${today} down, ${goal - today} to go today.`
                : `Nothing solved yet today. ${goal} would hit your goal.`}
          </p>
        </div>
        <Link href="/problems">
          <Button variant="primary">
            Browse problems
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>

      {/* ── top row ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--fg-subtle)]">
                Total solved
              </p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tabular-nums tracking-tight">
                  {stats.solved}
                </span>
                <span className="text-sm text-[var(--fg-muted)]">
                  / {stats.totalProblems} ({percent(stats.solved, stats.totalProblems)}%)
                </span>
              </p>
            </div>

            <div className="flex gap-6">
              {(["EASY", "MEDIUM", "HARD"] as const).map((d) => (
                <div key={d}>
                  <p
                    className={cn(
                      "text-[0.6875rem] font-medium uppercase tracking-wider",
                      d === "EASY" && "text-[var(--easy)]",
                      d === "MEDIUM" && "text-[var(--medium)]",
                      d === "HARD" && "text-[var(--hard)]",
                    )}
                  >
                    {d.charAt(0) + d.slice(1).toLowerCase()}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {stats.solvedByDifficulty[d] ?? 0}
                    <span className="text-xs font-normal text-[var(--fg-subtle)]">
                      /{stats.totalByDifficulty[d] ?? 0}
                    </span>
                  </p>
                  <ProgressBar
                    className="mt-1.5 w-16"
                    value={stats.solvedByDifficulty[d] ?? 0}
                    total={stats.totalByDifficulty[d] ?? 0}
                    tone={d.toLowerCase() as "easy" | "medium" | "hard"}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-4">
            <MiniStat
              icon={Flame}
              label="Current streak"
              value={streaks.current}
              suffix={streaks.current === 1 ? "day" : "days"}
              tone="medium"
            />
            <MiniStat
              icon={Trophy}
              label="Longest streak"
              value={streaks.longest}
              suffix={streaks.longest === 1 ? "day" : "days"}
            />
            <MiniStat
              icon={Target}
              label="Active days"
              value={streaks.activeDays}
              suffix="/ 365"
            />
            <MiniStat
              icon={RotateCcw}
              label="Due for revision"
              value={stats.dueCount}
              tone={stats.dueCount > 0 ? "hard" : undefined}
            />
          </div>
        </Card>

        <Card className="flex items-center justify-center p-5 lg:w-56">
          <GoalRing done={today} goal={goal} />
        </Card>
      </div>

      {/* ── heatmap ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Activity"
          subtitle={
            lcSync
              ? `${streaks.totalInPeriod} submissions in the last year · merged with LeetCode (@${lcSync.username})`
              : `${streaks.totalInPeriod} solves in the last year · link LeetCode in Settings to merge your real calendar`
          }
          action={
            !lcSync && (
              <Link href="/settings">
                <Button variant="ghost" size="sm">
                  <Sparkles className="size-3.5" />
                  Link LeetCode
                </Button>
              </Link>
            )
          }
        />
        <div className="px-5 pb-5">
          <Heatmap series={series} />
        </div>
      </Card>

      {/* ── bottom row ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Due for revision"
            subtitle={
              stats.dueCount === 0
                ? "Nothing due — solve something to start the cycle"
                : `${stats.dueCount} problem${stats.dueCount === 1 ? "" : "s"} ready for another pass`
            }
            action={
              stats.dueCount > 0 && (
                <Link href="/revision">
                  <Button variant="ghost" size="sm">
                    Review all
                    <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
              )
            }
          />
          {dueSoon.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-7" />}
              title="All caught up"
              description="Rate a solve on any problem page and it'll come back here on schedule."
            />
          ) : (
            <ul className="border-t border-[var(--border)]">
              {dueSoon.map((p) => (
                <li key={p.id} className="border-b border-[var(--border)] last:border-0">
                  <Link
                    href={`/problems/${p.problem.slug}`}
                    className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <RotateCcw className="size-3.5 shrink-0 text-[var(--medium)]" />
                    <span className="flex-1 truncate text-sm font-medium">{p.problem.title}</span>
                    <span className="text-[0.6875rem] text-[var(--fg-subtle)]">
                      due {relativeTime(p.nextReviewAt!)}
                    </span>
                    <DifficultyBadge difficulty={p.problem.difficulty} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recently solved" subtitle="Your last six" />
          {recent.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-7" />}
              title="No solves yet"
              description="Tick a problem off in the list and it'll show up here."
              action={
                <Link href="/problems">
                  <Button variant="primary" size="sm">
                    Find a problem
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="border-t border-[var(--border)]">
              {recent.map((p) => (
                <li key={p.id} className="border-b border-[var(--border)] last:border-0">
                  <Link
                    href={`/problems/${p.problem.slug}`}
                    className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <CheckCircle2 className="size-3.5 shrink-0 text-[var(--easy)]" />
                    <span className="flex-1 truncate text-sm font-medium">{p.problem.title}</span>
                    <Badge tone="outline">{p.problem.topic.name}</Badge>
                    <span className="w-20 text-right text-[0.6875rem] text-[var(--fg-subtle)]">
                      {p.solvedAt ? relativeTime(p.solvedAt) : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  suffix?: string;
  tone?: "medium" | "hard";
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)]",
          tone === "medium" && "bg-[var(--medium-soft)] text-[var(--medium)]",
          tone === "hard" && "bg-[var(--hard-soft)] text-[var(--hard)]",
          !tone && "text-[var(--fg-muted)]",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[0.6875rem] text-[var(--fg-subtle)]">{label}</p>
        <p className="text-sm font-semibold tabular-nums">
          {value}
          {suffix && <span className="ml-1 text-xs font-normal text-[var(--fg-muted)]">{suffix}</span>}
        </p>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
