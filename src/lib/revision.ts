import { REVIEW_INTERVALS } from "@/lib/constants";

/**
 * Advance the spaced-repetition schedule after a solve or a revision.
 *
 *   confident (3) → move up a rung, wait longer next time
 *   ok        (2) → repeat the current rung
 *   struggled (1) → back to the bottom, see it again tomorrow
 *
 * Returns the new stage and the timestamp the problem re-enters the queue.
 */
export function scheduleNextReview(currentStage: number, confidence: 1 | 2 | 3, from = new Date()) {
  const last = REVIEW_INTERVALS.length - 1;

  const stage =
    confidence === 3
      ? Math.min(currentStage + 1, last)
      : confidence === 2
        ? Math.min(currentStage, last)
        : 0;

  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + REVIEW_INTERVALS[stage]);
  // Reviews are due from the start of the target day, not the exact clock time,
  // so an evening solve doesn't hide tomorrow's review until the evening.
  next.setUTCHours(0, 0, 0, 0);

  return { reviewStage: stage, nextReviewAt: next };
}

export function intervalLabel(stage: number) {
  const days = REVIEW_INTERVALS[Math.min(stage, REVIEW_INTERVALS.length - 1)];
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  if (days === 7) return "in a week";
  if (days < 30) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}
