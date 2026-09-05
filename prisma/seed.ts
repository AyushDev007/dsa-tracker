/**
 * Seeds the problem catalogue from `data/problems.json`.
 *
 * Idempotent: safe to re-run after editing the curated list. It upserts by the
 * natural keys (slug / name), so existing user progress is never touched.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SHEETS, PATTERNS, TOPICS } from "../data/curated";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const prisma = new PrismaClient();

type BuiltProblem = {
  slug: string;
  title: string;
  leetcodeId: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  url: string;
  topic: string;
  pattern: string;
  sheets: string[];
  companies: string[];
  acceptance: number;
  isPremium: boolean;
  order: number;
  /** "curated" | "derived" — see data/taxonomy.ts. */
  taxonomy: string;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\//g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** One-line "why this pattern matters" blurbs shown on the pattern pages. */
const PATTERN_NOTES: Record<string, string> = {
  "Hashing / Frequency Map": "Trade memory for time: one pass to build counts, one pass to answer.",
  "Prefix Sum": "Precompute running totals so any range query becomes a subtraction.",
  "Two Pointers": "Two indices walking a sorted or partitioned array, converging in O(n).",
  "Sliding Window": "Grow the right edge, shrink the left while the window is invalid.",
  "Fast & Slow Pointers": "One pointer moves twice as fast — finds cycles and midpoints without extra space.",
  "In-place Reversal": "Rewire next-pointers as you walk. O(1) space linked-list surgery.",
  "Cyclic Sort": "When values are 1..n, put each number at its own index and read off what's wrong.",
  "Monotonic Stack": "Keep the stack sorted; each element is pushed and popped once, so it's O(n).",
  "Stack Simulation": "Model nesting or undo semantics directly with a stack.",
  "Modified Binary Search": "Binary search where the invariant isn't 'sorted' but 'predicate flips exactly once'.",
  "Binary Search on Answer": "Guess the answer, check feasibility in O(n), and bisect the answer space.",
  "Tree DFS": "Recurse, then combine children's results on the way up.",
  "Tree BFS": "Level-by-level with a queue — the right tool for anything depth-indexed.",
  "Tree Construction": "Rebuild a tree from traversals by locating the root and splitting the ranges.",
  Trie: "Prefix tree: share common prefixes so lookups cost O(word length), not O(dictionary).",
  "Top K Elements": "A size-k heap answers 'top k' in O(n log k) without sorting everything.",
  "Two Heaps": "A max-heap for the low half and min-heap for the high half keeps the median at the tips.",
  "K-way Merge": "A heap of k list heads merges k sorted sequences in O(n log k).",
  "Subsets / Combinations": "Choose-or-skip recursion. The template behind almost all backtracking.",
  Permutations: "Swap-in-place or used[] recursion to enumerate orderings.",
  "Graph Traversal": "DFS/BFS over an implicit or explicit graph, with a visited set.",
  "Multi-source BFS": "Seed the queue with every source at once so the first visit is the true minimum distance.",
  "Topological Sort": "Order a DAG by repeatedly taking nodes with in-degree 0. Also detects cycles.",
  "Union Find": "Near-O(1) merge and connectivity queries via path compression + union by rank.",
  "Shortest Path": "Dijkstra / Bellman-Ford / 0-1 BFS depending on edge weights.",
  "Minimum Spanning Tree": "Kruskal or Prim: cheapest edge set that keeps everything connected.",
  "1-D DP": "One state dimension. Almost always reducible to O(1) rolling variables.",
  "2-D DP / Grid": "State is a cell; transitions come from the neighbours you're allowed to move from.",
  "0/1 Knapsack": "Each item used at most once — iterate capacity downwards.",
  "Unbounded Knapsack": "Items reusable — iterate capacity upwards.",
  "Longest Increasing Subsequence": "O(n²) DP, or patience sorting with binary search for O(n log n).",
  "Longest Common Subsequence": "The two-string DP grid every edit-distance variant reduces to.",
  "Partition DP": "Try every split point in a range; memoise on (i, j). Matrix-chain family.",
  "State Machine DP": "Model holdings/cooldowns as explicit states and transition between them.",
  "DP on Trees": "Return a tuple per node: the answer including it and the answer excluding it.",
  "Kadane's Algorithm": "Reset the running sum whenever it stops helping.",
  "Expand Around Center": "Grow outwards from every centre — 2n−1 centres, O(n²) total.",
  Greedy: "Prove the local choice is safe, then never look back.",
  "Merge Intervals": "Sort by start, then either extend the last interval or push a new one.",
  "Matrix Traversal": "Boundary walking and in-place index gymnastics.",
  "Bit Manipulation": "XOR cancels pairs, & masks, and n & (n-1) clears the lowest set bit.",
  "Math & Number Theory": "Digits, primes, overflow handling and modular arithmetic.",
  "Divide & Conquer": "Halve the input, solve recursively, merge the halves.",
  "String Simulation": "No trick — just careful, exhaustive edge-case handling.",
  "Data Structure Design": "Compose hash maps, lists and heaps to hit the required complexities.",
};

async function main() {
  const problems: BuiltProblem[] = JSON.parse(
    readFileSync(resolve(ROOT, "data/problems.json"), "utf8"),
  );
  console.log(`→ seeding ${problems.length} problems`);

  // ── taxonomy ──────────────────────────────────────────────────────────────
  const topicIds = new Map<string, string>();
  for (const [i, name] of TOPICS.entries()) {
    const row = await prisma.topic.upsert({
      where: { name },
      update: { position: i, slug: slugify(name) },
      create: { name, slug: slugify(name), position: i },
    });
    topicIds.set(name, row.id);
  }

  const patternIds = new Map<string, string>();
  for (const [i, name] of PATTERNS.entries()) {
    const row = await prisma.pattern.upsert({
      where: { name },
      update: { position: i, slug: slugify(name), description: PATTERN_NOTES[name] ?? null },
      create: {
        name,
        slug: slugify(name),
        position: i,
        description: PATTERN_NOTES[name] ?? null,
      },
    });
    patternIds.set(name, row.id);
  }

  const sheetIds = new Map<string, string>();
  for (const [i, s] of SHEETS.entries()) {
    const row = await prisma.sheet.upsert({
      where: { slug: s.slug },
      update: { name: s.name, description: s.description, position: i },
      create: { slug: s.slug, name: s.name, description: s.description, position: i },
    });
    sheetIds.set(s.slug, row.id);
  }

  const companyNames = [...new Set(problems.flatMap((p) => p.companies))].sort();
  const companyIds = new Map<string, string>();
  for (const name of companyNames) {
    const row = await prisma.company.upsert({
      where: { name },
      update: { slug: slugify(name) },
      create: { name, slug: slugify(name) },
    });
    companyIds.set(name, row.id);
  }
  console.log(`  taxonomy: ${TOPICS.length} topics, ${PATTERNS.length} patterns, ${SHEETS.length} sheets, ${companyNames.length} companies`);

  // ── problems ──────────────────────────────────────────────────────────────
  //
  // The catalogue is ~3,300 rows, so this is written in batches rather than as
  // a per-problem upsert. The original loop issued about five queries per
  // problem; against a pooled Neon connection that is roughly 16,000 round
  // trips on every single deploy, which turns `vercel build` into a timeout
  // risk. Batched, it is a handful of statements.
  const existing = await prisma.problem.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      leetcodeId: true,
      url: true,
      difficulty: true,
      acceptance: true,
      isPremium: true,
      position: true,
      topicId: true,
      patternId: true,
      taxonomySource: true,
    },
  });
  const existingBySlug = new Map(existing.map((p) => [p.slug, p]));

  const toCreate: {
    slug: string;
    title: string;
    leetcodeId: number;
    url: string;
    difficulty: string;
    acceptance: number;
    isPremium: boolean;
    position: number;
    topicId: string;
    patternId: string;
    taxonomySource: string;
  }[] = [];
  const toUpdate: { slug: string; data: Record<string, unknown> }[] = [];

  for (const p of problems) {
    const topicId = topicIds.get(p.topic);
    const patternId = patternIds.get(p.pattern);
    if (!topicId || !patternId) throw new Error(`unmapped taxonomy for ${p.slug}`);

    const row = {
      title: p.title,
      leetcodeId: p.leetcodeId,
      url: p.url,
      difficulty: p.difficulty,
      acceptance: p.acceptance,
      isPremium: p.isPremium,
      position: p.order,
      topicId,
      patternId,
      taxonomySource: p.taxonomy,
    };

    const prev = existingBySlug.get(p.slug);
    if (!prev) {
      toCreate.push({ slug: p.slug, ...row });
      continue;
    }

    // Only write rows that actually changed. On a re-seed with no upstream
    // changes this makes the whole step a single SELECT.
    const changed = (Object.keys(row) as (keyof typeof row)[]).some(
      (k) => prev[k as keyof typeof prev] !== row[k],
    );
    if (changed) toUpdate.push({ slug: p.slug, data: row });
  }

  for (let i = 0; i < toCreate.length; i += 500) {
    await prisma.problem.createMany({ data: toCreate.slice(i, i + 500), skipDuplicates: true });
    console.log(`  created ${Math.min(i + 500, toCreate.length)}/${toCreate.length}`);
  }

  for (let i = 0; i < toUpdate.length; i += 200) {
    await prisma.$transaction(
      toUpdate
        .slice(i, i + 200)
        .map((u) => prisma.problem.update({ where: { slug: u.slug }, data: u.data })),
    );
    console.log(`  updated ${Math.min(i + 200, toUpdate.length)}/${toUpdate.length}`);
  }
  if (!toCreate.length && !toUpdate.length) console.log("  problems already up to date");

  // ── sheet & company links ────────────────────────────────────────────────
  // Only curated problems carry sheets or companies, so this touches ~311 rows
  // rather than the whole catalogue.
  const ids = new Map(
    (await prisma.problem.findMany({ select: { id: true, slug: true } })).map((p) => [
      p.slug,
      p.id,
    ]),
  );
  const linked = problems.filter((p) => p.sheets.length || p.companies.length);
  const linkedIds = linked.map((p) => ids.get(p.slug)!).filter(Boolean);

  // Relations are fully rebuilt so removing a tag in curated.ts actually
  // removes it from the database.
  await prisma.problemCompany.deleteMany({ where: { problemId: { in: linkedIds } } });
  await prisma.sheetProblem.deleteMany({ where: { problemId: { in: linkedIds } } });

  const companyLinks = linked.flatMap((p) =>
    p.companies.map((c) => ({ problemId: ids.get(p.slug)!, companyId: companyIds.get(c)! })),
  );
  const sheetLinks = linked.flatMap((p) =>
    p.sheets.map((s) => ({
      sheetId: sheetIds.get(s)!,
      problemId: ids.get(p.slug)!,
      position: p.order,
    })),
  );

  for (let i = 0; i < companyLinks.length; i += 1000) {
    await prisma.problemCompany.createMany({
      data: companyLinks.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < sheetLinks.length; i += 1000) {
    await prisma.sheetProblem.createMany({
      data: sheetLinks.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  console.log(`  linked ${sheetLinks.length} sheet entries, ${companyLinks.length} company tags`);

  // Drop catalogue rows that are no longer in the list. Cascades clear the
  // relations; a user's progress on a withdrawn problem goes with it, which is
  // correct — the problem no longer exists to be solved.
  const keep = problems.map((p) => p.slug);
  const removed = await prisma.problem.deleteMany({ where: { slug: { notIn: keep } } });
  if (removed.count) console.log(`  removed ${removed.count} problem(s) no longer in the catalogue`);

  const total = await prisma.problem.count();
  const derived = await prisma.problem.count({ where: { taxonomySource: "derived" } });
  console.log(
    `✓ seed complete — ${total} problems (${total - derived} curated taxonomy, ${derived} derived)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
