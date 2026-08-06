import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";

export type ProblemFilters = {
  q?: string;
  topic?: string;
  pattern?: string;
  difficulty?: string;
  status?: string;
  company?: string;
  sheet?: string;
  bookmarked?: boolean;
  sort?: string;
  page?: number;
  /** Skip pagination — the grouped views need every match, not one page. */
  all?: boolean;
};

const SORTS: Record<string, Prisma.ProblemOrderByWithRelationInput[]> = {
  default: [{ topic: { position: "asc" } }, { position: "asc" }, { leetcodeId: "asc" }],
  number: [{ leetcodeId: "asc" }],
  title: [{ title: "asc" }],
  "difficulty-asc": [{ difficulty: "asc" }, { leetcodeId: "asc" }], // EASY < HARD < MEDIUM alphabetically, remapped below
  acceptance: [{ acceptance: "desc" }],
};

/**
 * `difficulty` is stored as a string, so an alphabetical sort would read
 * EASY → HARD → MEDIUM. Ordering by a CASE expression is the one place raw SQL
 * beats the query builder, but keeping the whole listing in Prisma is worth
 * more than perfect difficulty ordering — so we sort that case in memory after
 * the page is fetched instead.
 */
const DIFFICULTY_RANK: Record<string, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };

export async function getProblems(userId: string, filters: ProblemFilters) {
  const where: Prisma.ProblemWhereInput = {};

  if (filters.q) {
    const q = filters.q.trim();
    const asNumber = Number(q);
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      ...(Number.isFinite(asNumber) && q !== "" ? [{ leetcodeId: asNumber }] : []),
    ];
  }
  if (filters.topic) where.topic = { slug: filters.topic };
  if (filters.pattern) where.pattern = { slug: filters.pattern };
  if (filters.difficulty) where.difficulty = filters.difficulty;
  if (filters.company) where.companies = { some: { company: { slug: filters.company } } };
  if (filters.sheet) where.sheets = { some: { sheet: { slug: filters.sheet } } };

  if (filters.status) {
    where.progress =
      filters.status === "TODO"
        ? // "To do" also covers problems with no progress row at all.
          { none: { userId, status: { in: ["SOLVED", "ATTEMPTED"] } } }
        : { some: { userId, status: filters.status } };
  }
  if (filters.bookmarked) {
    where.progress = { some: { userId, bookmarked: true } };
  }

  const page = Math.max(1, filters.page ?? 1);
  const sortKey = filters.sort ?? "default";
  const orderBy = SORTS[sortKey] ?? SORTS.default;

  const [rows, total] = await Promise.all([
    prisma.problem.findMany({
      where,
      orderBy,
      ...(filters.all ? {} : { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
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
    }),
    prisma.problem.count({ where }),
  ]);

  const list = rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    leetcodeId: p.leetcodeId,
    url: p.url,
    difficulty: p.difficulty,
    acceptance: p.acceptance,
    isPremium: p.isPremium,
    topic: p.topic,
    pattern: p.pattern,
    companies: p.companies.map((c) => c.company),
    sheets: p.sheets.map((s) => s.sheet),
    progress: p.progress[0] ?? null,
  }));

  if (sortKey === "difficulty-asc") {
    list.sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]);
  }
  if (sortKey === "difficulty-desc") {
    list.sort((a, b) => DIFFICULTY_RANK[b.difficulty] - DIFFICULTY_RANK[a.difficulty]);
  }

  return {
    problems: list,
    total,
    page,
    pageCount: filters.all ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export type ProblemListItem = Awaited<ReturnType<typeof getProblems>>["problems"][number];

/** Filter options with per-option counts, so the UI can show "Graphs · 34". */
export async function getFilterOptions() {
  const [topics, patterns, companies, sheets] = await Promise.all([
    prisma.topic.findMany({
      orderBy: { position: "asc" },
      select: { name: true, slug: true, _count: { select: { problems: true } } },
    }),
    prisma.pattern.findMany({
      orderBy: { position: "asc" },
      select: { name: true, slug: true, description: true, _count: { select: { problems: true } } },
    }),
    prisma.company.findMany({
      orderBy: { name: "asc" },
      select: { name: true, slug: true, _count: { select: { problems: true } } },
    }),
    prisma.sheet.findMany({
      orderBy: { position: "asc" },
      select: {
        name: true,
        slug: true,
        description: true,
        _count: { select: { problems: true } },
      },
    }),
  ]);

  return {
    topics: topics.filter((t) => t._count.problems > 0),
    patterns: patterns.filter((p) => p._count.problems > 0),
    companies: companies.filter((c) => c._count.problems > 0),
    sheets,
  };
}

/** Everything the dashboard needs, in one round of parallel queries. */
export async function getUserStats(userId: string) {
  const [totals, solvedByDifficulty, solvedByTopic, solvedByPattern, dueCount, bookmarked] =
    await Promise.all([
      prisma.problem.groupBy({ by: ["difficulty"], _count: true }),
      prisma.progress.findMany({
        where: { userId, status: "SOLVED" },
        select: { problem: { select: { difficulty: true } } },
      }),
      prisma.progress.findMany({
        where: { userId, status: "SOLVED" },
        select: { problem: { select: { topic: { select: { name: true, slug: true } } } } },
      }),
      prisma.progress.findMany({
        where: { userId, status: "SOLVED" },
        select: { problem: { select: { pattern: { select: { name: true, slug: true } } } } },
      }),
      prisma.progress.count({
        where: { userId, status: "SOLVED", nextReviewAt: { lte: new Date() } },
      }),
      prisma.progress.count({ where: { userId, bookmarked: true } }),
    ]);

  const totalByDifficulty = Object.fromEntries(
    totals.map((t) => [t.difficulty, t._count]),
  ) as Record<string, number>;

  const solvedCounts = { EASY: 0, MEDIUM: 0, HARD: 0 } as Record<string, number>;
  for (const row of solvedByDifficulty) solvedCounts[row.problem.difficulty]++;

  const tally = <T extends { name: string; slug: string }>(rows: T[]) => {
    const map = new Map<string, { name: string; slug: string; count: number }>();
    for (const r of rows) {
      const cur = map.get(r.slug);
      if (cur) cur.count++;
      else map.set(r.slug, { name: r.name, slug: r.slug, count: 1 });
    }
    return [...map.values()];
  };

  return {
    totalProblems: Object.values(totalByDifficulty).reduce((a, b) => a + b, 0),
    totalByDifficulty,
    solved: solvedByDifficulty.length,
    solvedByDifficulty: solvedCounts,
    solvedByTopic: tally(solvedByTopic.map((r) => r.problem.topic)),
    solvedByPattern: tally(solvedByPattern.map((r) => r.problem.pattern)),
    dueCount,
    bookmarked,
  };
}

/** Heatmap source: one row per active day, oldest first. */
export async function getActivity(userId: string, days = 365) {
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - days);

  return prisma.activityDay.findMany({
    where: { userId, day: { gte: from } },
    orderBy: { day: "asc" },
    select: { day: true, solved: true, revised: true, minutes: true },
  });
}

export async function getRevisionQueue(userId: string, limit = 100) {
  const rows = await prisma.progress.findMany({
    where: { userId, status: "SOLVED", nextReviewAt: { not: null } },
    orderBy: { nextReviewAt: "asc" },
    take: limit,
    include: {
      problem: {
        include: {
          topic: { select: { name: true, slug: true } },
          pattern: { select: { name: true, slug: true } },
        },
      },
    },
  });

  const now = new Date();
  return rows.map((r) => ({
    ...r,
    isDue: r.nextReviewAt !== null && r.nextReviewAt <= now,
  }));
}
