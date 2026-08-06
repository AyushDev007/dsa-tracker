/**
 * Fills one account with plausible history so the dashboard, heatmap and
 * analytics have something to show:  npm run db:demo -- [email]
 *
 * Deterministic (seeded PRNG) so re-running produces the same picture, and
 * destructive only for the target user's progress — never the catalogue.
 */
import { PrismaClient } from "@prisma/client";
import { scheduleNextReview } from "../src/lib/revision";

const prisma = new PrismaClient();

/** mulberry32 — small deterministic PRNG so the demo looks the same every run. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAYS = 120;
const TARGET_SOLVED = 96;

async function main() {
  const email = process.argv[2];
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (!user) {
    console.error("No user found. Sign in once first, then re-run this script.");
    process.exit(1);
  }
  console.log(`→ generating demo history for ${user.email}`);

  const rand = rng(20260805);

  // Wipe only this user's activity so re-runs stay idempotent.
  await prisma.$transaction([
    prisma.attempt.deleteMany({ where: { userId: user.id } }),
    prisma.activityDay.deleteMany({ where: { userId: user.id } }),
    prisma.progress.deleteMany({ where: { userId: user.id } }),
  ]);

  // Weight the picks so some topics look strong and others look neglected —
  // otherwise weak-area detection has nothing to detect.
  const STRONG = ["arrays-and-hashing", "two-pointers", "linked-list", "stack", "binary-search"];
  const WEAK = ["graphs", "2-d-dynamic-programming", "backtracking"];

  const problems = await prisma.problem.findMany({
    include: { topic: { select: { slug: true } } },
    orderBy: [{ topic: { position: "asc" } }, { position: "asc" }],
  });

  const weightOf = (topicSlug: string) =>
    STRONG.includes(topicSlug) ? 6 : WEAK.includes(topicSlug) ? 1 : 3;

  const pool = problems.flatMap((p) =>
    Array.from({ length: weightOf(p.topic.slug) }, () => p),
  );

  const picked = new Map<string, (typeof problems)[number]>();
  let guard = 0;
  while (picked.size < TARGET_SOLVED && guard++ < 20_000) {
    const p = pool[Math.floor(rand() * pool.length)];
    picked.set(p.id, p);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const perDay = new Map<string, { solved: number; revised: number; minutes: number }>();

  let solvedCount = 0;
  for (const problem of picked.values()) {
    // Spread solves across the window, biased toward recent weeks.
    const daysAgo = Math.floor(Math.pow(rand(), 1.7) * DAYS);
    const solvedAt = new Date(today);
    solvedAt.setUTCDate(solvedAt.getUTCDate() - daysAgo);
    solvedAt.setUTCHours(12 + Math.floor(rand() * 8), Math.floor(rand() * 60));
    // Today's picks would otherwise land at a clock time that hasn't happened
    // yet, and the UI would render "solved in 2 hours".
    if (solvedAt > new Date()) solvedAt.setTime(Date.now() - Math.floor(rand() * 3_600_000));

    const isWeak = WEAK.includes(problem.topic.slug);
    // Weak topics produce more "struggled" ratings and more hint usage.
    const roll = rand();
    const confidence: 1 | 2 | 3 = isWeak
      ? roll < 0.5
        ? 1
        : roll < 0.85
          ? 2
          : 3
      : roll < 0.12
        ? 1
        : roll < 0.4
          ? 2
          : 3;

    const usedHint = isWeak ? rand() < 0.45 : rand() < 0.12;
    const attemptCount = confidence === 1 ? 2 + Math.floor(rand() * 3) : rand() < 0.25 ? 2 : 1;

    const base = problem.difficulty === "EASY" ? 420 : problem.difficulty === "MEDIUM" ? 1200 : 2400;
    const durationSec = Math.round(base * (0.55 + rand() * 1.1) * (confidence === 1 ? 1.5 : 1));

    const { reviewStage, nextReviewAt } = scheduleNextReview(
      confidence === 3 ? 1 + Math.floor(rand() * 2) : 0,
      confidence,
      solvedAt,
    );

    await prisma.progress.create({
      data: {
        userId: user.id,
        problemId: problem.id,
        status: "SOLVED",
        solvedAt,
        confidence,
        reviewStage,
        nextReviewAt,
        lastReviewAt: solvedAt,
        reviewCount: confidence === 3 && rand() < 0.3 ? 1 : 0,
        attemptCount,
        timeSpentSec: durationSec,
        usedHint,
        bookmarked: rand() < 0.1,
        createdAt: solvedAt,
      },
    });

    await prisma.attempt.create({
      data: {
        userId: user.id,
        problemId: problem.id,
        kind: "SOLVE",
        durationSec,
        solved: true,
        usedHint,
        createdAt: solvedAt,
      },
    });

    const key = solvedAt.toISOString().slice(0, 10);
    const cur = perDay.get(key) ?? { solved: 0, revised: 0, minutes: 0 };
    cur.solved++;
    cur.minutes += Math.round(durationSec / 60);
    perDay.set(key, cur);
    solvedCount++;
  }

  // A handful of problems left mid-flight, so "attempted" isn't always empty.
  const attemptedOnly = problems.filter((p) => !picked.has(p.id)).slice(0, 14);
  for (const problem of attemptedOnly) {
    const daysAgo = Math.floor(rand() * 30);
    const at = new Date(today);
    at.setUTCDate(at.getUTCDate() - daysAgo);
    const durationSec = 600 + Math.floor(rand() * 1500);

    await prisma.progress.create({
      data: {
        userId: user.id,
        problemId: problem.id,
        status: "ATTEMPTED",
        attemptCount: 1 + Math.floor(rand() * 2),
        timeSpentSec: durationSec,
        usedHint: rand() < 0.4,
        createdAt: at,
      },
    });
    await prisma.attempt.create({
      data: {
        userId: user.id,
        problemId: problem.id,
        kind: "SOLVE",
        durationSec,
        solved: false,
        createdAt: at,
      },
    });

    const key = at.toISOString().slice(0, 10);
    const cur = perDay.get(key) ?? { solved: 0, revised: 0, minutes: 0 };
    cur.minutes += Math.round(durationSec / 60);
    perDay.set(key, cur);
  }

  await prisma.activityDay.createMany({
    data: [...perDay.entries()].map(([day, v]) => ({
      userId: user.id,
      day: new Date(`${day}T00:00:00Z`),
      solved: v.solved,
      revised: v.revised,
      minutes: v.minutes,
    })),
    skipDuplicates: true,
  });

  const due = await prisma.progress.count({
    where: { userId: user.id, status: "SOLVED", nextReviewAt: { lte: new Date() } },
  });

  console.log(`✓ ${solvedCount} solved, ${attemptedOnly.length} attempted`);
  console.log(`  ${perDay.size} active days over the last ${DAYS}`);
  console.log(`  ${due} problems now due for revision`);
  console.log(`\n  Clear it again from Settings → Reset all progress.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
