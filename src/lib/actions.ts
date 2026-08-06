"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scheduleNextReview } from "@/lib/revision";
import { toUtcDay, slugify } from "@/lib/utils";
import { STATUSES, LANGUAGES } from "@/lib/constants";
import { fetchLeetCodeProfile } from "@/lib/leetcode";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");
  return session.user.id;
}

/** Increment today's heatmap bucket. Called from every progress-changing action. */
async function bumpActivity(
  userId: string,
  patch: { solved?: number; revised?: number; minutes?: number },
) {
  const day = toUtcDay(new Date());
  await prisma.activityDay.upsert({
    where: { userId_day: { userId, day } },
    update: {
      solved: { increment: patch.solved ?? 0 },
      revised: { increment: patch.revised ?? 0 },
      minutes: { increment: patch.minutes ?? 0 },
    },
    create: {
      userId,
      day,
      solved: patch.solved ?? 0,
      revised: patch.revised ?? 0,
      minutes: patch.minutes ?? 0,
    },
  });
}

function revalidateProgressViews(slug?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/problems");
  revalidatePath("/revision");
  revalidatePath("/analytics");
  revalidatePath("/sheets");
  if (slug) revalidatePath(`/problems/${slug}`);
}

/* ───────────────────────────────────────────────────────────── progress ─── */

const setStatusSchema = z.object({
  problemId: z.string().min(1),
  status: z.enum(STATUSES),
});

export async function setStatus(input: z.infer<typeof setStatusSchema>) {
  const userId = await requireUser();
  const { problemId, status } = setStatusSchema.parse(input);

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { slug: true },
  });
  if (!problem) throw new Error("Unknown problem");

  const existing = await prisma.progress.findUnique({
    where: { userId_problemId: { userId, problemId } },
  });

  const wasSolved = existing?.status === "SOLVED";
  const nowSolved = status === "SOLVED";

  await prisma.progress.upsert({
    where: { userId_problemId: { userId, problemId } },
    update: {
      status,
      solvedAt: nowSolved ? (existing?.solvedAt ?? new Date()) : null,
      // Dropping out of SOLVED pulls the problem off the revision schedule.
      ...(nowSolved ? {} : { nextReviewAt: null, reviewStage: 0, confidence: null }),
    },
    create: {
      userId,
      problemId,
      status,
      solvedAt: nowSolved ? new Date() : null,
      attemptCount: status === "TODO" ? 0 : 1,
    },
  });

  if (!wasSolved && nowSolved) await bumpActivity(userId, { solved: 1 });
  if (wasSolved && !nowSolved) await bumpActivity(userId, { solved: -1 });

  revalidateProgressViews(problem.slug);
  return { ok: true };
}

export async function toggleBookmark(problemId: string) {
  const userId = await requireUser();

  const existing = await prisma.progress.findUnique({
    where: { userId_problemId: { userId, problemId } },
    select: { bookmarked: true },
  });

  const bookmarked = !existing?.bookmarked;
  await prisma.progress.upsert({
    where: { userId_problemId: { userId, problemId } },
    update: { bookmarked },
    create: { userId, problemId, bookmarked, status: "TODO" },
  });

  revalidatePath("/problems");
  return { bookmarked };
}

const rateSchema = z.object({
  problemId: z.string().min(1),
  confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** REVISION means "I already had this solved and re-solved it today". */
  kind: z.enum(["SOLVE", "REVISION"]).default("SOLVE"),
  durationSec: z.number().int().min(0).max(86_400).default(0),
  usedHint: z.boolean().default(false),
});

/**
 * The single action behind "I solved this" — records the attempt, marks the
 * problem solved, and moves it along the spaced-repetition ladder.
 */
export async function rateSolve(input: z.infer<typeof rateSchema>) {
  const userId = await requireUser();
  const { problemId, confidence, kind, durationSec, usedHint } = rateSchema.parse(input);

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { slug: true },
  });
  if (!problem) throw new Error("Unknown problem");

  const existing = await prisma.progress.findUnique({
    where: { userId_problemId: { userId, problemId } },
  });

  const { reviewStage, nextReviewAt } = scheduleNextReview(
    existing?.reviewStage ?? 0,
    confidence,
  );

  const wasSolved = existing?.status === "SOLVED";

  await prisma.$transaction([
    prisma.progress.upsert({
      where: { userId_problemId: { userId, problemId } },
      update: {
        status: "SOLVED",
        solvedAt: existing?.solvedAt ?? new Date(),
        confidence,
        reviewStage,
        nextReviewAt,
        lastReviewAt: new Date(),
        reviewCount: { increment: kind === "REVISION" ? 1 : 0 },
        attemptCount: { increment: 1 },
        timeSpentSec: { increment: durationSec },
        usedHint: usedHint || (existing?.usedHint ?? false),
      },
      create: {
        userId,
        problemId,
        status: "SOLVED",
        solvedAt: new Date(),
        confidence,
        reviewStage,
        nextReviewAt,
        lastReviewAt: new Date(),
        attemptCount: 1,
        timeSpentSec: durationSec,
        usedHint,
      },
    }),
    prisma.attempt.create({
      data: { userId, problemId, kind, durationSec, solved: true, usedHint },
    }),
  ]);

  await bumpActivity(userId, {
    solved: wasSolved ? 0 : 1,
    revised: kind === "REVISION" ? 1 : 0,
    minutes: Math.round(durationSec / 60),
  });

  revalidateProgressViews(problem.slug);
  return { ok: true, nextReviewAt, reviewStage };
}

const attemptSchema = z.object({
  problemId: z.string().min(1),
  durationSec: z.number().int().min(0).max(86_400),
  solved: z.boolean().default(false),
  usedHint: z.boolean().default(false),
});

/** Logs a timed session that did *not* end in a solve. */
export async function logAttempt(input: z.infer<typeof attemptSchema>) {
  const userId = await requireUser();
  const { problemId, durationSec, solved, usedHint } = attemptSchema.parse(input);

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { slug: true },
  });
  if (!problem) throw new Error("Unknown problem");

  const existing = await prisma.progress.findUnique({
    where: { userId_problemId: { userId, problemId } },
    select: { status: true },
  });

  await prisma.$transaction([
    prisma.progress.upsert({
      where: { userId_problemId: { userId, problemId } },
      update: {
        // Never downgrade a solved problem just because a timer was logged.
        status: existing?.status === "SOLVED" ? "SOLVED" : "ATTEMPTED",
        attemptCount: { increment: 1 },
        timeSpentSec: { increment: durationSec },
        usedHint: usedHint || undefined,
      },
      create: {
        userId,
        problemId,
        status: "ATTEMPTED",
        attemptCount: 1,
        timeSpentSec: durationSec,
        usedHint,
      },
    }),
    prisma.attempt.create({
      data: { userId, problemId, kind: "SOLVE", durationSec, solved, usedHint },
    }),
  ]);

  await bumpActivity(userId, { minutes: Math.round(durationSec / 60) });
  revalidateProgressViews(problem.slug);
  return { ok: true };
}

/* ──────────────────────────────────────────────────────────────── notes ─── */

const noteSchema = z.object({
  problemId: z.string().min(1),
  content: z.string().max(50_000).default(""),
  code: z.string().max(100_000).default(""),
  language: z.enum(LANGUAGES.map((l) => l.value) as [string, ...string[]]).default("python"),
  timeComplexity: z.string().max(120).optional().nullable(),
  spaceComplexity: z.string().max(120).optional().nullable(),
});

export async function saveNote(input: z.infer<typeof noteSchema>) {
  const userId = await requireUser();
  const data = noteSchema.parse(input);

  const problem = await prisma.problem.findUnique({
    where: { id: data.problemId },
    select: { slug: true },
  });
  if (!problem) throw new Error("Unknown problem");

  await prisma.note.upsert({
    where: { userId_problemId: { userId, problemId: data.problemId } },
    update: {
      content: data.content,
      code: data.code,
      language: data.language,
      timeComplexity: data.timeComplexity ?? null,
      spaceComplexity: data.spaceComplexity ?? null,
    },
    create: {
      userId,
      problemId: data.problemId,
      content: data.content,
      code: data.code,
      language: data.language,
      timeComplexity: data.timeComplexity ?? null,
      spaceComplexity: data.spaceComplexity ?? null,
    },
  });

  // Remember the language choice so the next problem opens in the same one.
  await prisma.user.update({
    where: { id: userId },
    data: { preferredLanguage: data.language },
  });

  revalidatePath(`/problems/${problem.slug}`);
  revalidatePath("/notes");
  return { ok: true, savedAt: new Date().toISOString() };
}

/* ───────────────────────────────────────────────────────────── settings ─── */

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  handle: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens only")
    .optional(),
  leetcodeUsername: z.string().trim().max(64).optional().nullable(),
  isPublic: z.boolean().optional(),
  dailyGoal: z.number().int().min(1).max(30).optional(),
});

export async function updateSettings(input: z.infer<typeof settingsSchema>) {
  const userId = await requireUser();
  const data = settingsSchema.parse(input);

  if (data.handle) {
    const taken = await prisma.user.findFirst({
      where: { handle: data.handle, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) return { ok: false as const, error: "That handle is already taken." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.handle !== undefined ? { handle: data.handle } : {}),
      ...(data.leetcodeUsername !== undefined
        ? { leetcodeUsername: data.leetcodeUsername || null }
        : {}),
      ...(data.isPublic !== undefined ? { isPublic: data.isPublic } : {}),
      ...(data.dailyGoal !== undefined ? { dailyGoal: data.dailyGoal } : {}),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/* ───────────────────────────────────────────────────────── leetcode sync ── */

/**
 * Pulls the user's public LeetCode profile and folds it into the tracker:
 * stats, the real submission calendar, and — optionally — auto-marking every
 * tracked problem LeetCode says is accepted.
 */
export async function syncLeetCode(options: { autoMark?: boolean } = {}) {
  const userId = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { leetcodeUsername: true },
  });

  const username = user?.leetcodeUsername?.trim();
  if (!username) {
    return { ok: false as const, error: "Add your LeetCode username in Settings first." };
  }

  const result = await fetchLeetCodeProfile(username);
  if (!result.ok) {
    await prisma.leetcodeSync.upsert({
      where: { userId },
      update: { username, lastError: result.error, lastSyncedAt: new Date() },
      create: { userId, username, lastError: result.error },
    });
    return { ok: false as const, error: result.error };
  }

  const p = result.profile;
  await prisma.leetcodeSync.upsert({
    where: { userId },
    update: {
      username,
      totalSolved: p.totalSolved,
      easySolved: p.easySolved,
      mediumSolved: p.mediumSolved,
      hardSolved: p.hardSolved,
      ranking: p.ranking,
      contestRating: p.contestRating,
      calendar: p.calendar,
      solvedSlugs: p.recentAcceptedSlugs,
      lastSyncedAt: new Date(),
      lastError: null,
    },
    create: {
      userId,
      username,
      totalSolved: p.totalSolved,
      easySolved: p.easySolved,
      mediumSolved: p.mediumSolved,
      hardSolved: p.hardSolved,
      ranking: p.ranking,
      contestRating: p.contestRating,
      calendar: p.calendar,
      solvedSlugs: p.recentAcceptedSlugs,
    },
  });

  let marked = 0;
  if (options.autoMark && p.recentAcceptedSlugs.length) {
    const problems = await prisma.problem.findMany({
      where: { slug: { in: p.recentAcceptedSlugs } },
      select: { id: true },
    });

    const alreadySolved = new Set(
      (
        await prisma.progress.findMany({
          where: { userId, status: "SOLVED", problemId: { in: problems.map((x) => x.id) } },
          select: { problemId: true },
        })
      ).map((x) => x.problemId),
    );

    for (const problem of problems) {
      if (alreadySolved.has(problem.id)) continue;
      await prisma.progress.upsert({
        where: { userId_problemId: { userId, problemId: problem.id } },
        update: { status: "SOLVED", solvedAt: new Date() },
        create: { userId, problemId: problem.id, status: "SOLVED", solvedAt: new Date() },
      });
      marked++;
    }
    if (marked) await bumpActivity(userId, { solved: marked });
  }

  revalidateProgressViews();
  revalidatePath("/settings");
  return { ok: true as const, profile: p, marked };
}

/* ─────────────────────────────────────────────────────────────── export ─── */

export async function exportProgressCsv() {
  const userId = await requireUser();

  const rows = await prisma.progress.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      problem: {
        include: { topic: { select: { name: true } }, pattern: { select: { name: true } } },
      },
    },
  });

  const notes = await prisma.note.findMany({
    where: { userId },
    select: { problemId: true, timeComplexity: true, spaceComplexity: true },
  });
  const noteByProblem = new Map(notes.map((n) => [n.problemId, n]));

  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = [
    "leetcode_id",
    "title",
    "slug",
    "difficulty",
    "topic",
    "pattern",
    "status",
    "confidence",
    "attempts",
    "time_spent_sec",
    "solved_at",
    "next_review_at",
    "review_count",
    "bookmarked",
    "time_complexity",
    "space_complexity",
    "url",
  ];

  const lines = rows.map((r) => {
    const n = noteByProblem.get(r.problemId);
    return [
      r.problem.leetcodeId,
      r.problem.title,
      r.problem.slug,
      r.problem.difficulty,
      r.problem.topic.name,
      r.problem.pattern.name,
      r.status,
      r.confidence ?? "",
      r.attemptCount,
      r.timeSpentSec,
      r.solvedAt?.toISOString() ?? "",
      r.nextReviewAt?.toISOString() ?? "",
      r.reviewCount,
      r.bookmarked,
      n?.timeComplexity ?? "",
      n?.spaceComplexity ?? "",
      r.problem.url,
    ]
      .map(esc)
      .join(",");
  });

  return [header.join(","), ...lines].join("\n");
}

/* ──────────────────────────────────────────────────────── danger zone ───── */

export async function resetAllProgress() {
  const userId = await requireUser();
  await prisma.$transaction([
    prisma.attempt.deleteMany({ where: { userId } }),
    prisma.activityDay.deleteMany({ where: { userId } }),
    prisma.progress.deleteMany({ where: { userId } }),
  ]);
  revalidateProgressViews();
  return { ok: true };
}

export async function suggestHandle(name: string) {
  return slugify(name).slice(0, 24);
}
