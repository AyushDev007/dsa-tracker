import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserStats, getActivity } from "@/lib/queries";
import { buildHeatmap, computeStreaks } from "@/lib/streaks";
import { Heatmap } from "@/components/heatmap";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { Card, CardHeader, Badge, ProgressBar, Button } from "@/components/ui/primitives";
import { percent } from "@/lib/utils";
import { Flame, Trophy, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const user = await prisma.user.findUnique({
    where: { handle },
    select: { name: true, isPublic: true },
  });
  if (!user?.isPublic) return { title: "Profile" };
  return {
    title: `${user.name ?? handle}'s DSA progress`,
    description: `Interview-prep progress for ${user.name ?? handle} — solved problems, streaks and coverage by topic.`,
  };
}

export default async function PublicProfile({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  const user = await prisma.user.findUnique({
    where: { handle },
    select: { id: true, name: true, image: true, isPublic: true, handle: true, createdAt: true },
  });
  if (!user) notFound();

  if (!user.isPublic) {
    return (
      <Shell>
        <Card className="mx-auto max-w-md p-10 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--fg-subtle)]">
            <Lock className="size-5" />
          </div>
          <h1 className="mt-4 text-lg font-semibold">This profile is private</h1>
          <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
            @{handle} hasn&apos;t made their progress public.
          </p>
        </Card>
      </Shell>
    );
  }

  const [stats, activity, sync, topicTotals] = await Promise.all([
    getUserStats(user.id),
    getActivity(user.id, 365),
    prisma.leetcodeSync.findUnique({ where: { userId: user.id } }),
    prisma.topic.findMany({
      orderBy: { position: "asc" },
      select: { name: true, slug: true, _count: { select: { problems: true } } },
    }),
  ]);

  const series = buildHeatmap(activity, (sync?.calendar as Record<string, number>) ?? {}, 365);
  const streaks = computeStreaks(series);
  const solvedByTopic = new Map(stats.solvedByTopic.map((t) => [t.slug, t.count]));

  const topTopics = topicTotals
    .filter((t) => t._count.problems > 0)
    .map((t) => ({
      name: t.name,
      slug: t.slug,
      solved: solvedByTopic.get(t.slug) ?? 0,
      total: t._count.problems,
    }))
    .sort((a, b) => b.solved - a.solved)
    .slice(0, 8);

  return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            {user.image ? (
              <Image
                src={user.image}
                alt=""
                width={56}
                height={56}
                className="size-14 rounded-full"
              />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-lg font-semibold text-[var(--accent)]">
                {(user.name ?? handle).slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold tracking-tight">{user.name ?? handle}</h1>
              <p className="text-sm text-[var(--fg-muted)]">
                @{user.handle}
                {sync && (
                  <>
                    {" · "}
                    <a
                      href={`https://leetcode.com/u/${sync.username}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[var(--accent)]"
                    >
                      LeetCode @{sync.username}
                    </a>
                  </>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge tone="medium" className="gap-1 px-2 py-1">
                <Flame className="size-3" />
                {streaks.current} day streak
              </Badge>
              <Badge tone="neutral" className="gap-1 px-2 py-1">
                <Trophy className="size-3" />
                best {streaks.longest}
              </Badge>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
            <PublicStat
              label="Tracker solved"
              value={stats.solved}
              hint={`of ${stats.totalProblems} (${percent(stats.solved, stats.totalProblems)}%)`}
            />
            <PublicStat label="Easy" value={stats.solvedByDifficulty.EASY ?? 0} tone="easy" />
            <PublicStat label="Medium" value={stats.solvedByDifficulty.MEDIUM ?? 0} tone="medium" />
            <PublicStat label="Hard" value={stats.solvedByDifficulty.HARD ?? 0} tone="hard" />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Activity"
            subtitle={`${streaks.totalInPeriod} submissions over ${streaks.activeDays} active days`}
          />
          <div className="px-5 pb-5">
            <Heatmap series={series} />
          </div>
        </Card>

        {topTopics.some((t) => t.solved > 0) && (
          <Card>
            <CardHeader title="Strongest topics" subtitle="By problems solved" />
            <div className="space-y-2.5 px-5 pb-5">
              {topTopics.map((t) => (
                <div key={t.slug} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-[0.8125rem] text-[var(--fg-muted)]">
                    {t.name}
                  </span>
                  <ProgressBar value={t.solved} total={t.total} className="flex-1" />
                  <span className="w-12 shrink-0 text-right text-xs text-[var(--fg-subtle)] tabular-nums">
                    {t.solved}/{t.total}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="pt-2 text-center">
          <Link href="/">
            <Button variant="outline" size="sm">
              Track your own progress
            </Button>
          </Link>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-5">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" />
          </Link>
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>
      <main className="px-5 py-8">{children}</main>
    </div>
  );
}

function PublicStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "easy" | "medium" | "hard";
}) {
  return (
    <div>
      <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--fg-subtle)]">
        {label}
      </p>
      <p
        className="mt-1 text-2xl font-semibold tabular-nums"
        style={tone ? { color: `var(--${tone})` } : undefined}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-[var(--fg-muted)]">{hint}</p>}
    </div>
  );
}
