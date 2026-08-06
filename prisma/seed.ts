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
  let n = 0;
  for (const p of problems) {
    const topicId = topicIds.get(p.topic);
    const patternId = patternIds.get(p.pattern);
    if (!topicId || !patternId) throw new Error(`unmapped taxonomy for ${p.slug}`);

    const problem = await prisma.problem.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        leetcodeId: p.leetcodeId,
        url: p.url,
        difficulty: p.difficulty,
        acceptance: p.acceptance,
        isPremium: p.isPremium,
        position: p.order,
        topicId,
        patternId,
      },
      create: {
        slug: p.slug,
        title: p.title,
        leetcodeId: p.leetcodeId,
        url: p.url,
        difficulty: p.difficulty,
        acceptance: p.acceptance,
        isPremium: p.isPremium,
        position: p.order,
        topicId,
        patternId,
      },
    });

    // Relations are fully rebuilt so removing a tag in curated.ts actually
    // removes it from the database.
    await prisma.problemCompany.deleteMany({ where: { problemId: problem.id } });
    if (p.companies.length) {
      await prisma.problemCompany.createMany({
        data: p.companies.map((c) => ({ problemId: problem.id, companyId: companyIds.get(c)! })),
        skipDuplicates: true,
      });
    }

    await prisma.sheetProblem.deleteMany({ where: { problemId: problem.id } });
    if (p.sheets.length) {
      await prisma.sheetProblem.createMany({
        data: p.sheets.map((s) => ({
          sheetId: sheetIds.get(s)!,
          problemId: problem.id,
          position: p.order,
        })),
        skipDuplicates: true,
      });
    }

    if (++n % 50 === 0) console.log(`  ${n}/${problems.length}`);
  }

  // Drop catalogue rows that are no longer in the curated list.
  const keep = problems.map((p) => p.slug);
  const removed = await prisma.problem.deleteMany({ where: { slug: { notIn: keep } } });
  if (removed.count) console.log(`  removed ${removed.count} problem(s) no longer curated`);

  console.log(`✓ seed complete — ${await prisma.problem.count()} problems in the database`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
