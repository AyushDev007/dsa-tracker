import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GroupedProblems } from "@/components/problems/grouped-problems";
import { Card, ProgressBar, Button } from "@/components/ui/primitives";
import { percent } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sheet = await prisma.sheet.findUnique({ where: { slug }, select: { name: true } });
  return { title: sheet?.name ?? "Sheet" };
}

export default async function SheetPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  const { slug } = await params;

  const sheet = await prisma.sheet.findUnique({
    where: { slug },
    include: {
      problems: {
        orderBy: { position: "asc" },
        include: {
          problem: {
            include: {
              topic: { select: { name: true, slug: true } },
              pattern: { select: { name: true, slug: true } },
              companies: { select: { company: { select: { name: true, slug: true } } } },
              sheets: { select: { sheet: { select: { name: true, slug: true } } } },
              progress: {
                where: { userId },
                select: {
                  status: true,
                  bookmarked: true,
                  confidence: true,
                  nextReviewAt: true,
                  timeSpentSec: true,
                  solvedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!sheet) notFound();

  const problems = sheet.problems.map((sp) => ({
    id: sp.problem.id,
    slug: sp.problem.slug,
    title: sp.problem.title,
    leetcodeId: sp.problem.leetcodeId,
    url: sp.problem.url,
    difficulty: sp.problem.difficulty,
    acceptance: sp.problem.acceptance,
    isPremium: sp.problem.isPremium,
    taxonomySource: sp.problem.taxonomySource,
    topic: sp.problem.topic,
    pattern: sp.problem.pattern,
    companies: sp.problem.companies.map((c) => c.company),
    sheets: sp.problem.sheets.map((s) => s.sheet),
    progress: sp.problem.progress[0] ?? null,
  }));

  const solved = problems.filter((p) => p.progress?.status === "SOLVED").length;
  const pct = percent(solved, problems.length);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <Link
        href="/sheets"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
      >
        <ArrowLeft className="size-3.5" />
        All sheets
      </Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="text-2xl font-semibold tracking-tight">{sheet.name}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--fg-muted)]">
              {sheet.description}
            </p>
          </div>
          <Link href={`/problems?sheet=${sheet.slug}`}>
            <Button variant="secondary" size="sm">
              Open in problem list
            </Button>
          </Link>
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold tabular-nums">
              {solved} of {problems.length} solved
            </span>
            <span className="text-sm text-[var(--fg-muted)] tabular-nums">{pct}%</span>
          </div>
          <ProgressBar
            className="mt-2 h-2"
            value={solved}
            total={problems.length}
            tone={pct === 100 ? "easy" : "accent"}
          />
        </div>
      </Card>

      <GroupedProblems problems={problems} groupBy="topic" />
    </div>
  );
}
