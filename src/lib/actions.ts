"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scheduleNextReview } from "@/lib/revision";
import { toUtcDay, slugify } from "@/lib/utils";
import { STATUSES, LANGUAGES } from "@/lib/constants";
import { fetchLeetCodeProfile, fetchSolvedSlugs } from "@/lib/leetcode";
import { encrypt, decrypt } from "@/lib/crypto";

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
 * How long a background sync waits before it will run again. The dashboard asks
 * for a sync on load, so without this every navigation would hit LeetCode.
 */
const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000;

const cookieSchema = z.object({
  session: z.string().trim().min(20, "That doesn't look like a LEETCODE_SESSION value."),
  csrf: z.string().trim().max(200).optional().nullable(),
});

/**
 * Stores the user's LeetCode session cookie so the full sync can run.
 *
 * The cookie is encrypted before it is written and is never read back to the
 * client — `getLeetCodeStatus` reports only whether one is present and working.
 */
export async function saveLeetCodeCookie(input: z.infer<typeof cookieSchema>) {
  const userId = await requireUser();
  const parsed = cookieSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid cookie." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { leetcodeUsername: true },
  });

  // Verify before storing: a cookie that doesn't authenticate is worse than no
  // cookie, because the UI would promise a full sync it can't deliver.
  const probe = await fetchSolvedSlugs({
    session: parsed.data.session,
    csrf: parsed.data.csrf ?? null,
  });
  if (!probe.ok) return { ok: false as const, error: probe.error };

  await prisma.leetcodeSync.upsert({
    where: { userId },
    update: {
      sessionCookie: encrypt(parsed.data.session),
      csrfToken: parsed.data.csrf ? encrypt(parsed.data.csrf) : null,
      cookieInvalidAt: null,
      lastError: null,
    },
    create: {
      userId,
      username: user?.leetcodeUsername?.trim() || "",
      sessionCookie: encrypt(parsed.data.session),
      csrfToken: parsed.data.csrf ? encrypt(parsed.data.csrf) : null,
    },
  });

  revalidatePath("/settings");
  return { ok: true as const, solvedOnLeetCode: probe.slugs.length };
}

/** Forgets the stored cookie. The username-only public sync keeps working. */
export async function clearLeetCodeCookie() {
  const userId = await requireUser();
  await prisma.leetcodeSync.updateMany({
    where: { userId },
    data: { sessionCookie: null, csrfToken: null, cookieInvalidAt: null, fullSyncAt: null },
  });
  revalidatePath("/settings");
  return { ok: true as const };
}

/** Turns background syncing on or off without unlinking anything. */
export async function setLeetCodeAutoSync(enabled: boolean) {
  const userId = await requireUser();
  await prisma.leetcodeSync.updateMany({ where: { userId }, data: { autoSync: enabled } });
  revalidatePath("/settings");
  return { ok: true as const };
}

/**
 * Marks tracker problems solved from a list of LeetCode slugs.
 *
 * Two things this deliberately does not do:
 *
 *   • It never un-marks. LeetCode not reporting a problem is not evidence you
 *     didn't solve it — you may have solved it in a notebook, or LeetCode may
 *     simply have paged us badly.
 *   • It never overwrites an existing SOLVED row's date, so a re-sync doesn't
 *     rewrite the history it already imported.
 *
 * `solvedAt` carries LeetCode's own submission timestamps where it exposed
 * them, so a backfill lands on the day it was actually solved rather than
 * dropping a thousand solves onto today's heatmap.
 */
async function markSolvedFromLeetCode(
  userId: string,
  slugs: string[],
  solvedAt: Record<string, number> = {},
) {
  if (!slugs.length) return { marked: 0, byDay: new Map<number, number>() };

  const problems = await prisma.problem.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  if (!problems.length) return { marked: 0, byDay: new Map<number, number>() };

  const existing = await prisma.progress.findMany({
    where: { userId, problemId: { in: problems.map((p) => p.id) } },
    select: { problemId: true, status: true },
  });
  const statusById = new Map(existing.map((p) => [p.problemId, p.status]));

  const toCreate: { userId: string; problemId: string; status: string; solvedAt: Date }[] = [];
  const toUpdate: { problemId: string; solvedAt: Date }[] = [];
  const byDay = new Map<number, number>();

  for (const problem of problems) {
    if (statusById.get(problem.id) === "SOLVED") continue;
    const when = solvedAt[problem.slug] ? new Date(solvedAt[problem.slug]) : new Date();

    if (statusById.has(problem.id)) toUpdate.push({ problemId: problem.id, solvedAt: when });
    else
      toCreate.push({ userId, problemId: problem.id, status: "SOLVED", solvedAt: when });

    const day = toUtcDay(when).getTime();
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  if (toCreate.length) await prisma.progress.createMany({ data: toCreate, skipDuplicates: true });

  // Rows that already existed as TODO/ATTEMPTED are promoted one at a time —
  // there are only ever a handful, and updateMany can't set a per-row date.
  for (const row of toUpdate) {
    await prisma.progress.update({
      where: { userId_problemId: { userId, problemId: row.problemId } },
      data: { status: "SOLVED", solvedAt: row.solvedAt },
    });
  }

  return { marked: toCreate.length + toUpdate.length, byDay };
}

/** Folds imported solves into the heatmap on the days they actually happened. */
async function recordImportedActivity(userId: string, byDay: Map<number, number>) {
  for (const [ms, count] of byDay) {
    const day = new Date(ms);
    await prisma.activityDay.upsert({
      where: { userId_day: { userId, day } },
      update: { solved: { increment: count } },
      create: { userId, day, solved: count },
    });
  }
}

/** Decrypts the stored credentials, or null if none are usable. */
async function storedCredentials(userId: string) {
  const row = await prisma.leetcodeSync.findUnique({
    where: { userId },
    select: { sessionCookie: true, csrfToken: true },
  });
  const session = decrypt(row?.sessionCookie);
  if (!session) return null;
  return { session, csrf: decrypt(row?.csrfToken) };
}

/**
 * Pulls the user's LeetCode data and folds it into the tracker.
 *
 * Runs in one of two modes depending on what's linked:
 *
 *   • **full** — a session cookie is stored, so every problem LeetCode records
 *     as accepted gets ticked, however long ago it was solved.
 *   • **public** — username only. Stats and the submission calendar are exact,
 *     but auto-marking sees only the 20 most recent accepted submissions,
 *     because that is LeetCode's hard server-side cap.
 */
export async function syncLeetCode(options: { autoMark?: boolean } = {}) {
  const userId = await requireUser();
  const autoMark = options.autoMark ?? true;

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

  // ── full sweep, when a session cookie is stored ──────────────────────────
  let mode: "full" | "public" = "public";
  let marked = 0;
  let fullSyncSolved: number | null = null;
  let cookieExpired = false;
  let byDay = new Map<number, number>();

  const creds = await storedCredentials(userId);
  if (creds) {
    const solved = await fetchSolvedSlugs(creds);
    if (solved.ok) {
      mode = "full";
      fullSyncSolved = solved.slugs.length;
      if (autoMark) {
        const res = await markSolvedFromLeetCode(userId, solved.slugs, solved.solvedAt);
        marked = res.marked;
        byDay = res.byDay;
      }
    } else {
      cookieExpired = Boolean(solved.expired);
      if (cookieExpired) {
        await prisma.leetcodeSync.updateMany({
          where: { userId },
          data: { cookieInvalidAt: new Date() },
        });
      }
    }
  }

  // ── public feed: the fallback, and the top-up for the full mode ──────────
  // Running it in full mode too costs nothing and catches a solve made in the
  // seconds between the status sweep and now.
  if (autoMark && mode === "public" && p.recentAcceptedSlugs.length) {
    const res = await markSolvedFromLeetCode(userId, p.recentAcceptedSlugs);
    marked = res.marked;
    byDay = res.byDay;
  }

  if (byDay.size) await recordImportedActivity(userId, byDay);

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
      lastMarked: marked,
      lastSyncedAt: new Date(),
      lastError: cookieExpired ? "Your LeetCode session cookie has expired." : null,
      ...(mode === "full" ? { fullSyncAt: new Date(), fullSyncSolved } : {}),
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
      lastMarked: marked,
    },
  });

  revalidateProgressViews();
  revalidatePath("/settings");
  return { ok: true as const, profile: p, marked, mode, fullSyncSolved, cookieExpired };
}

/**
 * Syncs only if the last sync is stale. Called from the app shell on navigation,
 * which is what makes new solves appear without anyone pressing a button.
 *
 * Returns quietly rather than throwing: a background refresh must never be able
 * to break the page that triggered it.
 */
export async function syncLeetCodeIfStale() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { ok: false as const, skipped: "signed-out" as const };

    const row = await prisma.leetcodeSync.findUnique({
      where: { userId },
      select: { autoSync: true, lastSyncedAt: true, cookieInvalidAt: true },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { leetcodeUsername: true },
    });
    if (!user?.leetcodeUsername) return { ok: false as const, skipped: "not-linked" as const };

    if (row && !row.autoSync) return { ok: false as const, skipped: "disabled" as const };
    if (row && Date.now() - row.lastSyncedAt.getTime() < AUTO_SYNC_INTERVAL_MS) {
      return { ok: false as const, skipped: "fresh" as const };
    }

    const res = await syncLeetCode({ autoMark: true });
    return res.ok
      ? { ok: true as const, marked: res.marked, mode: res.mode }
      : { ok: false as const, skipped: "error" as const };
  } catch {
    return { ok: false as const, skipped: "error" as const };
  }
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
