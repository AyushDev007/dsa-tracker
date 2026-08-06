"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Star, RotateCcw, CheckCircle2, Circle, MinusCircle } from "lucide-react";
import { Card, CardHeader, Badge } from "@/components/ui/primitives";
import { setStatus, toggleBookmark, rateSolve } from "@/lib/actions";
import { CONFIDENCE, REVIEW_INTERVALS, type Status } from "@/lib/constants";
import { intervalLabel } from "@/lib/revision";
import { cn, formatDuration, relativeTime } from "@/lib/utils";
import { SolveTimer } from "./solve-timer";
import { NotesEditor } from "./notes-editor";

type ProgressShape = {
  status: string;
  confidence: number | null;
  reviewStage: number;
  nextReviewAt: string | null;
  attemptCount: number;
  timeSpentSec: number;
  bookmarked: boolean;
  solvedAt: string | null;
  reviewCount: number;
} | null;

type NoteShape = {
  content: string;
  code: string;
  language: string;
  timeComplexity: string | null;
  spaceComplexity: string | null;
  updatedAt: string;
} | null;

export function ProblemWorkspace({
  problem,
  progress,
  note,
  defaultLanguage,
}: {
  problem: { id: string; slug: string; title: string };
  progress: ProgressShape;
  note: NoteShape;
  defaultLanguage: string;
}) {
  const [, startTransition] = useTransition();
  const [bookmarked, setBookmarked] = useState(progress?.bookmarked ?? false);
  const [status, setLocalStatus] = useState<Status>((progress?.status ?? "TODO") as Status);
  const [elapsed, setElapsed] = useState(0);
  const [usedHint, setUsedHint] = useState(false);

  const isSolved = status === "SOLVED";
  const alreadySolvedBefore = Boolean(progress?.solvedAt);

  const changeStatus = (next: Status) => {
    startTransition(async () => {
      setLocalStatus(next);
      try {
        await setStatus({ problemId: problem.id, status: next });
        toast.success(
          next === "SOLVED"
            ? "Marked solved — rate it below to schedule a revision"
            : next === "ATTEMPTED"
              ? "Marked as attempted"
              : "Reset to to-do",
        );
      } catch {
        setLocalStatus((progress?.status ?? "TODO") as Status);
        toast.error("Couldn't save that");
      }
    });
  };

  const rate = (confidence: 1 | 2 | 3) => {
    startTransition(async () => {
      try {
        const res = await rateSolve({
          problemId: problem.id,
          confidence,
          kind: alreadySolvedBefore ? "REVISION" : "SOLVE",
          durationSec: elapsed,
          usedHint,
        });
        setLocalStatus("SOLVED");
        setElapsed(0);
        setUsedHint(false);
        toast.success(
          `Scheduled — back ${intervalLabel(res.reviewStage)}`,
          { description: CONFIDENCE[confidence].label },
        );
      } catch {
        toast.error("Couldn't save your rating");
      }
    });
  };

  const onBookmark = () => {
    startTransition(async () => {
      setBookmarked((b) => !b);
      try {
        await toggleBookmark(problem.id);
      } catch {
        setBookmarked((b) => !b);
        toast.error("Couldn't update bookmark");
      }
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <NotesEditor problemId={problem.id} note={note} defaultLanguage={defaultLanguage} />

      <div className="space-y-4">
        {/* ── status ─────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Status"
            action={
              <button
                onClick={onBookmark}
                className="rounded-md p-1 text-[var(--fg-subtle)] transition-colors hover:text-[var(--medium)]"
                aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
              >
                <Star
                  className={cn(
                    "size-4",
                    bookmarked && "fill-[var(--medium)] text-[var(--medium)]",
                  )}
                />
              </button>
            }
          />
          <div className="grid grid-cols-3 gap-1.5 px-5 pb-4">
            {(
              [
                ["TODO", "To do", Circle],
                ["ATTEMPTED", "Tried", MinusCircle],
                ["SOLVED", "Solved", CheckCircle2],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                onClick={() => changeStatus(value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-all",
                  status === value
                    ? value === "SOLVED"
                      ? "border-[var(--easy)] bg-[var(--easy-soft)] text-[var(--easy)]"
                      : value === "ATTEMPTED"
                        ? "border-[var(--medium)] bg-[var(--medium-soft)] text-[var(--medium)]"
                        : "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          {progress && (progress.attemptCount > 0 || progress.timeSpentSec > 0) && (
            <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)] px-5 py-3 text-xs">
              <div>
                <p className="text-[var(--fg-subtle)]">Attempts</p>
                <p className="font-semibold tabular-nums">{progress.attemptCount}</p>
              </div>
              <div>
                <p className="text-[var(--fg-subtle)]">Time logged</p>
                <p className="font-semibold tabular-nums">
                  {formatDuration(progress.timeSpentSec)}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* ── timer ──────────────────────────────────────────────────────── */}
        <SolveTimer
          problemId={problem.id}
          elapsed={elapsed}
          onElapsedChange={setElapsed}
          usedHint={usedHint}
          onUsedHintChange={setUsedHint}
        />

        {/* ── spaced repetition ──────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title={alreadySolvedBefore ? "Rate this revision" : "Rate your solve"}
            subtitle="Sets when it comes back"
          />
          <div className="space-y-1.5 px-5 pb-4">
            {([3, 2, 1] as const).map((value) => {
              const c = CONFIDENCE[value];
              const nextStage =
                value === 3
                  ? Math.min((progress?.reviewStage ?? 0) + 1, REVIEW_INTERVALS.length - 1)
                  : value === 2
                    ? (progress?.reviewStage ?? 0)
                    : 0;

              return (
                <button
                  key={value}
                  onClick={() => rate(value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5 text-left transition-all",
                    "hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]",
                    progress?.confidence === value && "border-[var(--accent)] bg-[var(--accent-soft)]",
                  )}
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      c.tone === "ok" && "bg-[var(--easy)]",
                      c.tone === "warn" && "bg-[var(--medium)]",
                      c.tone === "danger" && "bg-[var(--hard)]",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.8125rem] font-medium">{c.label}</span>
                    <span className="block text-[0.6875rem] text-[var(--fg-subtle)]">{c.hint}</span>
                  </span>
                  <Badge tone="outline" className="shrink-0">
                    {intervalLabel(nextStage)}
                  </Badge>
                </button>
              );
            })}
          </div>

          {progress?.nextReviewAt && (
            <div className="flex items-center gap-2 border-t border-[var(--border)] px-5 py-3 text-xs">
              <RotateCcw className="size-3.5 shrink-0 text-[var(--accent)]" />
              <span className="text-[var(--fg-muted)]">
                Next revision {relativeTime(progress.nextReviewAt)}
              </span>
              {progress.reviewCount > 0 && (
                <Badge tone="outline" className="ml-auto">
                  {progress.reviewCount}×
                </Badge>
              )}
            </div>
          )}
        </Card>

        {isSolved && !progress?.nextReviewAt && (
          <p className="px-1 text-xs text-[var(--fg-subtle)]">
            Solved but not scheduled — pick a rating above to add it to the revision queue.
          </p>
        )}
      </div>
    </div>
  );
}
