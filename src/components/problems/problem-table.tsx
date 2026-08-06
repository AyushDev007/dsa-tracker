"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { ExternalLink, Star, Lock, Search } from "lucide-react";
import { toast } from "sonner";
import type { ProblemListItem } from "@/lib/queries";
import { setStatus, toggleBookmark } from "@/lib/actions";
import { DifficultyBadge, Badge, EmptyState } from "@/components/ui/primitives";
import { cn, relativeTime } from "@/lib/utils";
import { StatusCycler } from "./status-cycler";

export function ProblemTable({ problems }: { problems: ProblemListItem[] }) {
  if (problems.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState
          icon={<Search className="size-8" />}
          title="No problems match those filters"
          description="Try removing a filter or searching for something else."
        />
      </div>
    );
  }

  return (
    <div className="animate-rise overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left">
              <Th className="w-12 pl-4">Done</Th>
              <Th className="w-14">#</Th>
              <Th>Problem</Th>
              <Th className="w-40">Topic</Th>
              <Th className="w-48">Pattern</Th>
              <Th className="w-24">Difficulty</Th>
              <Th className="w-24 text-right">Acceptance</Th>
              <Th className="w-24 pr-4 text-right">Links</Th>
            </tr>
          </thead>
          <tbody>
            {problems.map((p) => (
              <ProblemRow key={p.id} problem={p} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]",
        className,
      )}
    >
      {children}
    </th>
  );
}

function ProblemRow({ problem }: { problem: ProblemListItem }) {
  const [, startTransition] = useTransition();
  const [optimisticBookmark, setOptimisticBookmark] = useOptimistic(
    problem.progress?.bookmarked ?? false,
  );

  const status = problem.progress?.status ?? "TODO";

  const onBookmark = () => {
    startTransition(async () => {
      setOptimisticBookmark(!optimisticBookmark);
      try {
        await toggleBookmark(problem.id);
      } catch {
        toast.error("Couldn't update bookmark");
      }
    });
  };

  return (
    <tr
      className={cn(
        "border-b border-[var(--border)] transition-colors last:border-0",
        "hover:bg-[var(--surface-2)]",
        status === "SOLVED" && "bg-[var(--easy-soft)]/25",
      )}
    >
      <td className="py-2 pl-4">
        <StatusCycler
          problemId={problem.id}
          status={status}
          onChange={async (next) => {
            await setStatus({ problemId: problem.id, status: next });
          }}
        />
      </td>

      <td className="px-3 py-2 font-mono text-xs text-[var(--fg-subtle)] tabular-nums">
        {problem.leetcodeId}
      </td>

      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/problems/${problem.slug}`}
            className={cn(
              "font-medium transition-colors hover:text-[var(--accent)]",
              status === "SOLVED" && "text-[var(--fg-muted)]",
            )}
          >
            {problem.title}
          </Link>
          {problem.isPremium && (
            <span title="LeetCode Premium problem">
              <Lock className="size-3 text-[var(--medium)]" />
            </span>
          )}
          {problem.progress?.nextReviewAt && (
            <span
              className="text-[0.6875rem] text-[var(--fg-subtle)]"
              title={`Next revision ${problem.progress.nextReviewAt.toLocaleDateString()}`}
            >
              ↻ {relativeTime(problem.progress.nextReviewAt)}
            </span>
          )}
        </div>
        {problem.sheets.length > 0 && (
          <div className="mt-1 flex gap-1">
            {problem.sheets.map((s) => (
              <Badge key={s.slug} tone="outline" className="text-[0.625rem]">
                {s.name}
              </Badge>
            ))}
          </div>
        )}
      </td>

      <td className="px-3 py-2">
        <Link
          href={`/problems?topic=${problem.topic.slug}`}
          className="text-[0.8125rem] text-[var(--fg-muted)] hover:text-[var(--accent)]"
        >
          {problem.topic.name}
        </Link>
      </td>

      <td className="px-3 py-2">
        <Link
          href={`/problems?pattern=${problem.pattern.slug}`}
          className="text-[0.8125rem] text-[var(--fg-muted)] hover:text-[var(--accent)]"
        >
          {problem.pattern.name}
        </Link>
      </td>

      <td className="px-3 py-2">
        <DifficultyBadge difficulty={problem.difficulty} />
      </td>

      <td className="px-3 py-2 text-right font-mono text-xs text-[var(--fg-muted)] tabular-nums">
        {problem.acceptance ? `${problem.acceptance.toFixed(1)}%` : "—"}
      </td>

      <td className="py-2 pr-4">
        <div className="flex items-center justify-end gap-0.5">
          <button
            onClick={onBookmark}
            className="rounded-md p-1.5 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--medium)]"
            aria-label={optimisticBookmark ? "Remove bookmark" : "Bookmark"}
            title={optimisticBookmark ? "Remove bookmark" : "Bookmark"}
          >
            <Star
              className={cn("size-4", optimisticBookmark && "fill-[var(--medium)] text-[var(--medium)]")}
            />
          </button>
          <a
            href={problem.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md p-1.5 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--accent)]"
            aria-label={`Open ${problem.title} on LeetCode`}
            title="Open on LeetCode"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      </td>
    </tr>
  );
}
