import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRevisionQueue } from "@/lib/queries";
import { Card, CardHeader, Badge, DifficultyBadge, Button, EmptyState } from "@/components/ui/primitives";
import { REVIEW_INTERVALS, CONFIDENCE } from "@/lib/constants";
import { cn, relativeTime } from "@/lib/utils";
import { RotateCcw, CalendarClock, CheckCircle2, ArrowRight } from "lucide-react";

export const metadata = { title: "Revision" };
export const dynamic = "force-dynamic";

export default async function RevisionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const queue = await getRevisionQueue(session.user.id, 200);
  const due = queue.filter((q) => q.isDue);
  const upcoming = queue.filter((q) => !q.isDue);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Revision</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--fg-muted)]">
          Problems come back on a widening schedule — {REVIEW_INTERVALS.join(", ")} days. Re-solve
          the ones that are due, then rate them again to push them further out.
        </p>
      </div>

      <Card>
        <CardHeader
          title={`Due now (${due.length})`}
          subtitle={
            due.length === 0
              ? "Nothing waiting on you"
              : "Open each one, re-solve it from scratch, then rate it"
          }
        />
        {due.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-8" />}
            title="Queue is clear"
            description="Everything you've solved is still inside its interval. Come back when something is due, or solve something new."
            action={
              <Link href="/problems">
                <Button variant="primary" size="sm">
                  Find a new problem
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            }
          />
        ) : (
          <ul className="border-t border-[var(--border)]">
            {due.map((item) => (
              <li key={item.id} className="border-b border-[var(--border)] last:border-0">
                <Link
                  href={`/problems/${item.problem.slug}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--medium-soft)] text-[var(--medium)]">
                    <RotateCcw className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.problem.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-[var(--fg-subtle)]">
                      <span>{item.problem.pattern.name}</span>
                      <span>·</span>
                      <span>
                        due {relativeTime(item.nextReviewAt!)} · seen {item.reviewCount + 1}×
                      </span>
                    </p>
                  </div>
                  {item.confidence && (
                    <Badge
                      tone={
                        item.confidence === 3 ? "easy" : item.confidence === 2 ? "medium" : "hard"
                      }
                    >
                      {CONFIDENCE[item.confidence as 1 | 2 | 3].label}
                    </Badge>
                  )}
                  <DifficultyBadge difficulty={item.problem.difficulty} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title={`Scheduled (${upcoming.length})`}
          subtitle="Not due yet — nothing to do here, this is just the road ahead"
        />
        {upcoming.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="size-7" />}
            title="Nothing scheduled"
            description="Rate a solve on any problem page to add it to the schedule."
          />
        ) : (
          <ul className="border-t border-[var(--border)]">
            {upcoming.slice(0, 40).map((item) => (
              <li key={item.id} className="border-b border-[var(--border)] last:border-0">
                <Link
                  href={`/problems/${item.problem.slug}`}
                  className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <CalendarClock className="size-3.5 shrink-0 text-[var(--fg-subtle)]" />
                  <span className="flex-1 truncate text-sm text-[var(--fg-muted)]">
                    {item.problem.title}
                  </span>
                  <StageDots stage={item.reviewStage} />
                  <span className="w-28 text-right text-[0.6875rem] text-[var(--fg-subtle)]">
                    {relativeTime(item.nextReviewAt!)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Visual ladder position — how far along the interval schedule a problem is. */
function StageDots({ stage }: { stage: number }) {
  return (
    <span className="hidden gap-0.5 sm:flex" title={`Interval ${stage + 1} of ${REVIEW_INTERVALS.length}`}>
      {REVIEW_INTERVALS.map((_, i) => (
        <span
          key={i}
          className={cn(
            "size-1.5 rounded-full",
            i <= stage ? "bg-[var(--accent)]" : "bg-[var(--surface-2)]",
          )}
        />
      ))}
    </span>
  );
}
