import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, Badge, DifficultyBadge, Button } from "@/components/ui/primitives";
import { ProblemWorkspace } from "@/components/problems/problem-workspace";
import { formatDuration, relativeTime } from "@/lib/utils";
import { ExternalLink, ArrowLeft, Lock, ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: { title: true, leetcodeId: true },
  });
  return { title: problem ? `${problem.leetcodeId}. ${problem.title}` : "Problem" };
}

export default async function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  const { slug } = await params;

  const problem = await prisma.problem.findUnique({
    where: { slug },
    include: {
      topic: true,
      pattern: true,
      companies: { select: { company: { select: { name: true, slug: true } } } },
      sheets: { select: { sheet: { select: { name: true, slug: true } } } },
    },
  });
  if (!problem) notFound();

  const [progress, note, attempts, user, neighbours] = await Promise.all([
    prisma.progress.findUnique({ where: { userId_problemId: { userId, problemId: problem.id } } }),
    prisma.note.findUnique({ where: { userId_problemId: { userId, problemId: problem.id } } }),
    prisma.attempt.findMany({
      where: { userId, problemId: problem.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { preferredLanguage: true } }),
    // Prev/next within the same topic, so you can work straight down a topic.
    prisma.problem.findMany({
      where: { topicId: problem.topicId },
      orderBy: [{ position: "asc" }, { leetcodeId: "asc" }],
      select: { slug: true, title: true, position: true, leetcodeId: true },
    }),
  ]);

  const idx = neighbours.findIndex((n) => n.slug === problem.slug);
  const prev = idx > 0 ? neighbours[idx - 1] : null;
  const next = idx >= 0 && idx < neighbours.length - 1 ? neighbours[idx + 1] : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link
        href={`/problems?topic=${problem.topic.slug}`}
        className="inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
      >
        <ArrowLeft className="size-3.5" />
        {problem.topic.name}
      </Link>

      {/* ── header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2.5 text-2xl font-semibold tracking-tight">
            <span className="font-mono text-lg text-[var(--fg-subtle)] tabular-nums">
              {problem.leetcodeId}.
            </span>
            {problem.title}
            {problem.isPremium && (
              <span title="LeetCode Premium">
                <Lock className="size-4 text-[var(--medium)]" />
              </span>
            )}
          </h1>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <DifficultyBadge difficulty={problem.difficulty} />
            <Link href={`/problems?topic=${problem.topic.slug}`}>
              <Badge tone="neutral" className="hover:border-[var(--accent)]">
                {problem.topic.name}
              </Badge>
            </Link>
            <Link href={`/problems?pattern=${problem.pattern.slug}`}>
              <Badge tone="accent">{problem.pattern.name}</Badge>
            </Link>
            {problem.sheets.map(({ sheet }) => (
              <Link key={sheet.slug} href={`/sheets/${sheet.slug}`}>
                <Badge tone="outline">{sheet.name}</Badge>
              </Link>
            ))}
            <Badge tone="outline">{problem.acceptance.toFixed(1)}% acceptance</Badge>
          </div>
        </div>

        <a href={problem.url} target="_blank" rel="noopener noreferrer">
          <Button variant="primary">
            Open on LeetCode
            <ExternalLink className="size-4" />
          </Button>
        </a>
      </div>

      {problem.pattern.description && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)]/40 px-4 py-3">
          <p className="text-[0.8125rem]">
            <span className="font-semibold">{problem.pattern.name}</span>
            <span className="mx-1.5 text-[var(--fg-subtle)]">·</span>
            <span className="text-[var(--fg-muted)]">{problem.pattern.description}</span>
          </p>
        </div>
      )}

      {/* ── workspace ────────────────────────────────────────────────────── */}
      <ProblemWorkspace
        problem={{ id: problem.id, slug: problem.slug, title: problem.title }}
        progress={
          progress && {
            status: progress.status,
            confidence: progress.confidence,
            reviewStage: progress.reviewStage,
            nextReviewAt: progress.nextReviewAt?.toISOString() ?? null,
            attemptCount: progress.attemptCount,
            timeSpentSec: progress.timeSpentSec,
            bookmarked: progress.bookmarked,
            solvedAt: progress.solvedAt?.toISOString() ?? null,
            reviewCount: progress.reviewCount,
          }
        }
        note={
          note && {
            content: note.content,
            code: note.code,
            language: note.language,
            timeComplexity: note.timeComplexity,
            spaceComplexity: note.spaceComplexity,
            updatedAt: note.updatedAt.toISOString(),
          }
        }
        defaultLanguage={user?.preferredLanguage ?? "python"}
      />

      {/* ── meta ─────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Asked at" subtitle="Commonly reported — treat as a hint, not a list" />
          <div className="flex flex-wrap gap-1.5 px-5 pb-5">
            {problem.companies.length === 0 ? (
              <p className="text-[0.8125rem] text-[var(--fg-subtle)]">No company tags.</p>
            ) : (
              problem.companies.map(({ company }) => (
                <Link key={company.slug} href={`/problems?company=${company.slug}`}>
                  <Badge tone="neutral" className="hover:border-[var(--accent)]">
                    {company.name}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Your attempts" subtitle={`${attempts.length} logged`} />
          <div className="px-5 pb-5">
            {attempts.length === 0 ? (
              <p className="text-[0.8125rem] text-[var(--fg-subtle)]">
                Use the timer above and your sessions show up here.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {attempts.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-[0.8125rem]">
                    <span
                      className={
                        a.solved ? "text-[var(--easy)]" : "text-[var(--fg-subtle)]"
                      }
                    >
                      {a.solved ? "✓" : "○"}
                    </span>
                    <span className="text-[var(--fg-muted)]">
                      {a.kind === "REVISION" ? "Revision" : "Solve"}
                    </span>
                    <span className="font-mono text-xs tabular-nums">
                      {formatDuration(a.durationSec)}
                    </span>
                    {a.usedHint && <Badge tone="medium">hint</Badge>}
                    <span className="ml-auto text-[0.6875rem] text-[var(--fg-subtle)]">
                      {relativeTime(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Next in this topic" subtitle={problem.topic.name} />
          <div className="space-y-2 px-5 pb-5">
            {prev && (
              <Link
                href={`/problems/${prev.slug}`}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[0.8125rem] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
              >
                <ChevronLeft className="size-3.5 shrink-0 text-[var(--fg-subtle)]" />
                <span className="truncate">{prev.title}</span>
              </Link>
            )}
            {next && (
              <Link
                href={`/problems/${next.slug}`}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[0.8125rem] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
              >
                <span className="truncate">{next.title}</span>
                <ChevronRight className="ml-auto size-3.5 shrink-0 text-[var(--fg-subtle)]" />
              </Link>
            )}
            {!prev && !next && (
              <p className="text-[0.8125rem] text-[var(--fg-subtle)]">
                Only problem in this topic.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
