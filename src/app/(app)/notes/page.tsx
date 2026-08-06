import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { Card, Badge, DifficultyBadge, EmptyState, Button } from "@/components/ui/primitives";
import { NotesSearch } from "@/components/notes-search";
import { relativeTime } from "@/lib/utils";
import { NotebookPen, Code2 } from "lucide-react";

export const metadata = { title: "Notes" };
export const dynamic = "force-dynamic";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const { q } = await searchParams;
  const query = q?.trim();

  const where: Prisma.NoteWhereInput = { userId: session.user.id };
  if (query) {
    where.OR = [
      { content: { contains: query, mode: "insensitive" } },
      { code: { contains: query, mode: "insensitive" } },
      { problem: { title: { contains: query, mode: "insensitive" } } },
    ];
  }

  const notes = await prisma.note.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      problem: {
        select: {
          slug: true,
          title: true,
          leetcodeId: true,
          difficulty: true,
          topic: { select: { name: true } },
          pattern: { select: { name: true } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Everything you&apos;ve written, searchable across write-ups and solution code.
        </p>
      </div>

      <NotesSearch initial={query ?? ""} />

      {notes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<NotebookPen className="size-8" />}
            title={query ? `Nothing matches “${query}”` : "No notes yet"}
            description={
              query
                ? "Try a different word, or clear the search."
                : "Open any problem and use the Notes tab to write down your approach. It'll show up here."
            }
            action={
              !query && (
                <Link href="/problems">
                  <Button variant="primary" size="sm">
                    Browse problems
                  </Button>
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <Card key={n.id} className="p-4 transition-colors hover:border-[var(--border-strong)]">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/problems/${n.problem.slug}`}
                  className="font-medium hover:text-[var(--accent)]"
                >
                  <span className="mr-1.5 font-mono text-xs text-[var(--fg-subtle)] tabular-nums">
                    {n.problem.leetcodeId}.
                  </span>
                  {n.problem.title}
                </Link>
                <DifficultyBadge difficulty={n.problem.difficulty} />
                <Badge tone="outline">{n.problem.pattern.name}</Badge>
                {n.code.trim() && (
                  <Badge tone="accent">
                    <Code2 className="size-3" />
                    {n.language}
                  </Badge>
                )}
                <span className="ml-auto text-[0.6875rem] text-[var(--fg-subtle)]">
                  {relativeTime(n.updatedAt)}
                </span>
              </div>

              {n.content.trim() && (
                <p className="mt-2 line-clamp-3 text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-[var(--fg-muted)]">
                  {/* Strip markdown syntax for the preview — the full render lives on the problem page. */}
                  {n.content.replace(/[#*`>_[\]]/g, "").slice(0, 320)}
                </p>
              )}

              {(n.timeComplexity || n.spaceComplexity) && (
                <div className="mt-2 flex gap-3 font-mono text-[0.6875rem] text-[var(--fg-subtle)]">
                  {n.timeComplexity && <span>time {n.timeComplexity}</span>}
                  {n.spaceComplexity && <span>space {n.spaceComplexity}</span>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
