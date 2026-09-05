/**
 * Derives a topic and a pattern for problems that are *not* in the curated list.
 *
 * `data/curated.ts` hand-assigns a topic and pattern to 311 problems. The other
 * ~2,950 free problems on LeetCode have no hand-written taxonomy, but the
 * `Problem` table requires both columns, and browsing "by topic" / "by pattern"
 * is the whole point of the app — so they have to come from somewhere.
 *
 * They come from LeetCode's own `topicTags`, mapped through the ordered rule
 * table below. The rules are deliberately ordered most-specific-first: a problem
 * tagged both `array` and `union-find` is a Union Find problem, not an array
 * problem, so the union-find rule has to be reached first.
 *
 * What this is and isn't:
 *
 *   • It is deterministic and auditable. Same tags in, same taxonomy out, and
 *     `npm run problems:build` prints the full distribution so a bad rule shows
 *     up as an implausible bucket size rather than silently mislabelling 400
 *     problems.
 *   • It is not as good as hand curation. LeetCode's tags are broad ("array"
 *     covers 1,914 problems) and sometimes list every technique that *could*
 *     solve a problem. A derived pattern is a reasonable guess, not a promise.
 *
 * That distinction is carried in the data: every problem records whether its
 * taxonomy was `curated` or `derived`, and the UI says so rather than
 * presenting the two as equally authoritative.
 */
import type { Pattern, Topic } from "./curated";

export type TaxonomySource = "curated" | "derived";

export type DerivedTaxonomy = {
  topic: Topic;
  pattern: Pattern;
  /** The rule that matched — surfaced in the build report so rules stay auditable. */
  rule: string;
};

/** LeetCode's non-algorithm categories, which need their own handling. */
const CATEGORY_RULES: Record<string, DerivedTaxonomy> = {
  database: { topic: "Database (SQL)", pattern: "SQL Query", rule: "category:database" },
  pandas: { topic: "Database (SQL)", pattern: "SQL Query", rule: "category:pandas" },
  shell: { topic: "Concurrency & Shell", pattern: "Shell Scripting", rule: "category:shell" },
  concurrency: {
    topic: "Concurrency & Shell",
    pattern: "Concurrency Primitives",
    rule: "category:concurrency",
  },
  javascript: { topic: "JavaScript", pattern: "JavaScript / Async", rule: "category:javascript" },
};

type Rule = {
  /** Rule name, for the build report. */
  name: string;
  /** Any one of these tags matching fires the rule. */
  tags: string[];
  /** All of these must also be present, when given. */
  and?: string[];
  /** None of these may be present, when given. */
  not?: string[];
  /** Additionally require one of these words in the title, when given. */
  title?: RegExp;
  topic: Topic;
  pattern: Pattern;
};

/**
 * Ordered: the first rule that matches wins. Specific techniques come first,
 * broad container tags (`array`, `string`, `hash-table`) last, because almost
 * every problem carries one of those and they would otherwise swallow everything.
 */
const RULES: Rule[] = [
  // ── named data structures ────────────────────────────────────────────────
  { name: "trie", tags: ["trie"], topic: "Trie", pattern: "Trie" },
  {
    name: "segment-tree",
    tags: [
      "segment-tree",
      "binary-indexed-tree",
      "sqrt-decomposition",
      "sparse-table",
      "li-chao-tree",
      "range-minimum-maximum-query",
      "persistent-data-structure",
      "treap",
      "cartesian-tree",
      "palindromic-tree",
      "k-d-tree",
    ],
    topic: "Segment Tree & BIT",
    pattern: "Segment Tree / Fenwick",
  },
  { name: "union-find", tags: ["union-find"], topic: "Graphs", pattern: "Union Find" },

  // ── graph algorithms, before the generic graph traversal rule ─────────────
  {
    name: "topological-sort",
    tags: ["topological-sort", "directed-acyclic-graph"],
    topic: "Graphs",
    pattern: "Topological Sort",
  },
  {
    name: "shortest-path",
    tags: [
      "shortest-path",
      "dijkstra",
      "bellman-ford-algorithm",
      "floyd-warshall-algorithm",
      "0-1-bfs",
      "k-shortest-path",
      "bidirectional-search",
      "successive-shortest-path-algorithm",
    ],
    topic: "Graphs",
    pattern: "Shortest Path",
  },
  {
    name: "mst",
    tags: [
      "minimum-spanning-tree",
      "prims-algorithm",
      "kruskals-algorithm",
      "boruvkas-algorithm",
    ],
    topic: "Graphs",
    pattern: "Minimum Spanning Tree",
  },

  // ── stack / queue shapes ─────────────────────────────────────────────────
  { name: "monotonic-stack", tags: ["monotonic-stack"], topic: "Stack", pattern: "Monotonic Stack" },
  { name: "monotonic-queue", tags: ["monotonic-queue"], topic: "Queue", pattern: "Monotonic Queue" },

  // ── window / pointer shapes ──────────────────────────────────────────────
  { name: "sliding-window", tags: ["sliding-window"], topic: "Sliding Window", pattern: "Sliding Window" },
  {
    name: "fast-slow-pointers",
    tags: ["floyds-cycle-finding-algorithm"],
    topic: "Linked List",
    pattern: "Fast & Slow Pointers",
  },
  {
    name: "two-pointers",
    tags: ["two-pointers"],
    not: ["linked-list"],
    topic: "Two Pointers",
    pattern: "Two Pointers",
  },
  { name: "prefix-sum", tags: ["prefix-sum"], topic: "Arrays & Hashing", pattern: "Prefix Sum" },

  // ── binary search: "on answer" when the title asks to optimise a value ────
  {
    name: "binary-search-on-answer",
    tags: ["binary-search"],
    title: /\b(minimi[sz]e|maximi[sz]e|minimum|maximum|smallest|largest|kth|k-th)\b/i,
    topic: "Binary Search",
    pattern: "Binary Search on Answer",
  },
  {
    name: "binary-search",
    tags: ["binary-search", "ternary-search"],
    topic: "Binary Search",
    pattern: "Modified Binary Search",
  },
  {
    name: "bst",
    tags: ["binary-search-tree"],
    topic: "Binary Search Tree",
    pattern: "Tree DFS",
  },

  // ── dynamic programming, most specific flavour first ─────────────────────
  { name: "dp-on-trees", tags: ["dp-on-trees"], topic: "Trees", pattern: "DP on Trees" },
  {
    name: "lis",
    tags: ["longest-increasing-subsequence"],
    topic: "1-D Dynamic Programming",
    pattern: "Longest Increasing Subsequence",
  },
  {
    name: "lcs",
    tags: ["longest-common-subsequence"],
    topic: "2-D Dynamic Programming",
    pattern: "Longest Common Subsequence",
  },
  {
    name: "unbounded-knapsack",
    tags: ["complete-knapsack", "multiple-knapsack", "mixed-knapsack"],
    topic: "1-D Dynamic Programming",
    pattern: "Unbounded Knapsack",
  },
  {
    name: "knapsack",
    tags: ["0-1-knapsack", "knapsack-problem"],
    topic: "1-D Dynamic Programming",
    pattern: "0/1 Knapsack",
  },
  {
    name: "game-theory",
    tags: [
      "game-theory",
      "nim-game",
      "impartial-game",
      "zero-sum-game",
      "minimax-algorithm",
      "sprague-grundy-theorem",
    ],
    topic: "1-D Dynamic Programming",
    pattern: "Game Theory",
  },
  {
    name: "bitmask-dp",
    tags: ["bitmask"],
    and: ["dynamic-programming"],
    topic: "1-D Dynamic Programming",
    pattern: "Bitmask DP",
  },
  {
    name: "grid-dp",
    tags: ["dynamic-programming"],
    and: ["matrix"],
    topic: "2-D Dynamic Programming",
    pattern: "2-D DP / Grid",
  },
  {
    name: "dp",
    tags: ["dynamic-programming"],
    topic: "1-D Dynamic Programming",
    pattern: "1-D DP",
  },

  // ── backtracking ─────────────────────────────────────────────────────────
  {
    name: "permutations",
    tags: ["backtracking"],
    title: /\bpermutation|arrangement|order(ing)?s?\b/i,
    topic: "Backtracking",
    pattern: "Permutations",
  },
  {
    name: "backtracking",
    tags: ["backtracking", "algorithm-x", "dancing-links"],
    topic: "Backtracking",
    pattern: "Subsets / Combinations",
  },

  // ── trees before graphs: a binary-tree problem tagged `dfs` is a tree ─────
  {
    name: "tree-bfs",
    tags: ["breadth-first-search"],
    and: ["binary-tree"],
    topic: "Trees",
    pattern: "Tree BFS",
  },
  {
    name: "tree-dfs",
    tags: ["binary-tree", "tree", "lowest-common-ancestor"],
    topic: "Trees",
    pattern: "Tree DFS",
  },

  // ── graphs ───────────────────────────────────────────────────────────────
  {
    name: "multi-source-bfs",
    tags: ["breadth-first-search"],
    and: ["matrix"],
    topic: "Graphs",
    pattern: "Multi-source BFS",
  },
  {
    name: "graph",
    tags: [
      "graph",
      "depth-first-search",
      "breadth-first-search",
      "bipartite-graph",
      "strongly-connected-component",
      "eulerian-circuit",
      "eulerian-path",
      "eulerian-graph",
      "semi-eulerian-graph",
      "kosarajus-algorithm",
      "tarjans-scc-algorithm",
      "articulation-point",
      "bridge-graph",
      "biconnected-component",
      "flow-network",
      "maximum-flow",
      "minimum-cut",
      "minimum-cost-flow",
      "dinics-algorithm",
      "edmonds-karp-algorithm",
      "push-relabel-algorithm",
      "mpm-algorithm",
      "hungarian-algorithm",
      "matching-graph",
      "maximum-matching",
      "perfect-matching",
      "graph-coloring",
      "hamiltonian-path",
      "planar-graph",
      "binary-lifting",
    ],
    topic: "Graphs",
    pattern: "Graph Traversal",
  },

  // ── linear structures ────────────────────────────────────────────────────
  {
    name: "linked-list",
    tags: ["linked-list", "doubly-linked-list"],
    topic: "Linked List",
    pattern: "In-place Reversal",
  },
  {
    name: "heap",
    tags: ["heap-priority-queue", "quickselect", "tournament-sort"],
    topic: "Heap / Priority Queue",
    pattern: "Top K Elements",
  },
  {
    name: "design",
    tags: ["design", "data-stream", "iterator", "hash-function"],
    topic: "Design",
    pattern: "Data Structure Design",
  },

  // ── strings ──────────────────────────────────────────────────────────────
  {
    name: "string-matching",
    tags: [
      "string-matching",
      "rolling-hash",
      "z-algorithm",
      "knuth-morris-pratt-algorithm",
      "manacher",
      "suffix-array",
      "suffix-tree",
      "suffix-automaton",
      "aho-corasick-algorithm",
      "boyer-moore-string-search-algorithm",
      "lyndon-factorization",
      "lexicographically-minimal-string-rotation",
    ],
    topic: "Strings",
    pattern: "String Matching",
  },

  // ── bits, matrices, stacks ───────────────────────────────────────────────
  {
    name: "bit-manipulation",
    tags: ["bit-manipulation", "bitmask"],
    topic: "Bit Manipulation",
    pattern: "Bit Manipulation",
  },
  { name: "matrix", tags: ["matrix"], topic: "Matrix", pattern: "Matrix Traversal" },
  {
    name: "stack",
    tags: ["stack", "bracket-sequences"],
    topic: "Stack",
    pattern: "Stack Simulation",
  },
  { name: "queue", tags: ["queue"], topic: "Queue", pattern: "Simulation" },

  // ── intervals & sweeps ───────────────────────────────────────────────────
  { name: "sweep-line", tags: ["sweep-line"], topic: "Intervals", pattern: "Sweep Line" },
  {
    name: "intervals",
    tags: ["sorting", "ordered-set"],
    title: /\binterval|meeting|calendar|booking|range[s]?\b/i,
    topic: "Intervals",
    pattern: "Merge Intervals",
  },

  { name: "greedy", tags: ["greedy"], topic: "Greedy", pattern: "Greedy" },

  {
    name: "divide-and-conquer",
    tags: ["divide-and-conquer", "merge-sort", "quicksort", "meet-in-the-middle"],
    topic: "Arrays & Hashing",
    pattern: "Divide & Conquer",
  },

  // ── maths ────────────────────────────────────────────────────────────────
  {
    name: "combinatorics",
    tags: ["combinatorics", "probability-and-statistics", "inclusion-exclusion-principle", "pigeonhole-principle"],
    topic: "Math & Geometry",
    pattern: "Combinatorics",
  },
  {
    name: "randomized",
    tags: ["randomized", "reservoir-sampling", "rejection-sampling"],
    topic: "Math & Geometry",
    pattern: "Combinatorics",
  },
  {
    name: "math",
    tags: [
      "math",
      "number-theory",
      "geometry",
      "polygons",
      "convex-hull",
      "triangulation",
      "linear-algebra",
      "greatest-common-divisor",
      "least-common-multiple",
      "euclidean-algorithm",
      "extended-euclidean-algorithm",
      "bezouts-lemma",
      "prime-factorization",
      "primality-test",
      "prime-number-sieve",
      "sieve-theory",
      "fermats-little-theorem",
      "eulers-totient-function",
      "eulers-theorem",
      "newtons-method",
      "brainteaser",
      "sort",
    ],
    topic: "Math & Geometry",
    pattern: "Math & Number Theory",
  },

  // ── recursion without an explicit DP tag ─────────────────────────────────
  {
    name: "memoization",
    tags: ["memoization", "recursion"],
    topic: "1-D Dynamic Programming",
    pattern: "Memoization",
  },

  // ── generic shapes, last ─────────────────────────────────────────────────
  {
    name: "simulation",
    tags: ["simulation", "interactive", "heuristic-search", "a-search", "brute-force-search"],
    topic: "Simulation",
    pattern: "Simulation",
  },
  {
    name: "sorting",
    tags: [
      "sorting",
      "counting-sort",
      "bucket-sort",
      "radix-sort",
      "bubble-sort",
      "timsort",
      "ordered-set",
    ],
    topic: "Arrays & Hashing",
    pattern: "Sorting",
  },
  {
    name: "counting",
    tags: ["counting", "enumeration", "boyer-moore-majority-vote-algorithm"],
    topic: "Arrays & Hashing",
    pattern: "Counting / Enumeration",
  },
  {
    name: "hash-table",
    tags: ["hash-table"],
    topic: "Arrays & Hashing",
    pattern: "Hashing / Frequency Map",
  },
  { name: "string", tags: ["string"], topic: "Strings", pattern: "String Simulation" },
  { name: "array", tags: ["array"], topic: "Arrays & Hashing", pattern: "Array Manipulation" },
];

/**
 * Last resort for the ~76 free problems LeetCode ships with no topic tags at
 * all. Reported separately by the build script so the count stays visible.
 */
const FALLBACK: DerivedTaxonomy = {
  topic: "Simulation",
  pattern: "Simulation",
  rule: "fallback:untagged",
};

export function deriveTaxonomy(input: {
  tags: string[];
  title: string;
  category?: string;
}): DerivedTaxonomy {
  const byCategory = input.category ? CATEGORY_RULES[input.category] : undefined;
  if (byCategory) return byCategory;

  const tags = new Set(input.tags);
  if (tags.size === 0) return FALLBACK;

  for (const rule of RULES) {
    if (!rule.tags.some((t) => tags.has(t))) continue;
    if (rule.and && !rule.and.every((t) => tags.has(t))) continue;
    if (rule.not && rule.not.some((t) => tags.has(t))) continue;
    if (rule.title && !rule.title.test(input.title)) continue;
    return { topic: rule.topic, pattern: rule.pattern, rule: rule.name };
  }

  return FALLBACK;
}
