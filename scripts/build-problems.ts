/**
 * Builds `data/problems.json`, which is what the Prisma seed reads.
 *
 * Run with:  npm run problems:build
 *
 * Two sources are joined:
 *
 *   • LeetCode's public GraphQL problem list — every problem's title, number,
 *     difficulty, acceptance rate, premium flag and topic tags, plus which
 *     category (algorithms / database / shell / …) it belongs to.
 *   • `data/curated.ts` — the hand-written topic, pattern, sheet and company
 *     assignments for 311 problems.
 *
 * Every *free* problem on LeetCode ends up in the output. Curated ones keep
 * their hand-written taxonomy; the rest get one derived from LeetCode's topic
 * tags by `data/taxonomy.ts`, and are marked `taxonomy: "derived"` so the app
 * can be honest about which is which.
 *
 * Premium-only problems are excluded, because they cannot be opened without a
 * LeetCode subscription and tracking something you cannot solve is noise. The
 * one exception is a problem that is *already curated*: eight of the curated
 * 311 (`alien-dictionary`, `meeting-rooms`, …) have become premium-only since
 * the list was written, and they are load-bearing members of Blind 75 and
 * NeetCode 150. Dropping them would quietly put a hole in those sheets, so
 * curated problems stay in and are flagged `isPremium` for the UI to mark.
 *
 * The generated JSON is committed, so seeding (and therefore `vercel build`)
 * never needs network access. Re-run this after editing the curated list, or
 * periodically to pick up newly published problems.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CURATED, TOPICS, PATTERNS, SHEETS, type CuratedProblem } from "../data/curated";
import { deriveTaxonomy, type TaxonomySource } from "../data/taxonomy";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "data/problems.json");

const GRAPHQL = "https://leetcode.com/graphql";
const PAGE_SIZE = 100; // LeetCode caps the page size at 100 regardless of what we ask for.
const PAGE_DELAY_MS = 250; // Be a polite client: ~4 req/s against a free public endpoint.

/** Categories other than "algorithms", so each problem can be tagged with its own. */
const CATEGORIES = ["database", "shell", "concurrency", "javascript", "pandas"] as const;

const LIST_QUERY = `
  query problemsetQuestionList($cat: String!, $skip: Int!, $limit: Int!, $filters: QuestionListFilterInput) {
    problemsetQuestionList: questionList(categorySlug: $cat, limit: $limit, skip: $skip, filters: $filters) {
      total: totalNum
      questions: data {
        questionFrontendId
        title
        titleSlug
        difficulty
        isPaidOnly
        acRate
        topicTags { slug }
      }
    }
  }
`;

type LeetCodeQuestion = {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  isPaidOnly: boolean;
  acRate: number;
  topicTags: { slug: string }[];
};

export type BuiltProblem = {
  slug: string;
  title: string;
  leetcodeId: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  url: string;
  topic: string;
  pattern: string;
  /** "curated" = hand-assigned in data/curated.ts, "derived" = inferred from LeetCode tags. */
  taxonomy: TaxonomySource;
  sheets: string[];
  companies: string[];
  acceptance: number;
  isPremium: boolean;
  order: number;
};

const DIFFICULTY = { Easy: "EASY", Medium: "MEDIUM", Hard: "HARD" } as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function graphql<T>(variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (compatible; dsa-tracker/1.0; dataset build script)",
      referer: "https://leetcode.com/problemset/",
    },
    body: JSON.stringify({ query: LIST_QUERY, variables }),
  });
  if (!res.ok) throw new Error(`LeetCode returned ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`LeetCode GraphQL error: ${json.errors[0].message}`);
  if (!json.data) throw new Error("LeetCode returned no data");
  return json.data;
}

/** Pages through one category and returns every question in it. */
async function fetchCategory(cat: string, label: string): Promise<LeetCodeQuestion[]> {
  const out: LeetCodeQuestion[] = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const data = await graphql<{
      problemsetQuestionList: { total: number; questions: LeetCodeQuestion[] };
    }>({ cat, skip, limit: PAGE_SIZE, filters: {} });

    const { total, questions } = data.problemsetQuestionList;
    out.push(...questions);
    process.stdout.write(`\r  ${label}: ${out.length}/${total}`);
    if (questions.length === 0 || out.length >= total) break;
    await sleep(PAGE_DELAY_MS);
  }
  process.stdout.write("\n");
  return out;
}

/** Merge duplicate slugs (a problem can legitimately teach two patterns). */
function dedupe(list: CuratedProblem[]) {
  const byslug = new Map<string, CuratedProblem>();
  const dupes: string[] = [];
  for (const p of list) {
    const existing = byslug.get(p.slug);
    if (!existing) {
      byslug.set(p.slug, { ...p, sheets: [...(p.sheets ?? [])], companies: [...(p.companies ?? [])] });
      continue;
    }
    dupes.push(p.slug);
    existing.sheets = [...new Set([...(existing.sheets ?? []), ...(p.sheets ?? [])])];
    existing.companies = [...new Set([...(existing.companies ?? []), ...(p.companies ?? [])])];
  }
  return { list: [...byslug.values()], dupes };
}

async function main() {
  console.log("→ fetching the LeetCode problem list");
  const all = await fetchCategory("", "all");

  // Which category each problem belongs to. Anything not claimed by one of the
  // specialist categories is an algorithms problem.
  const categoryBySlug = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const rows = await fetchCategory(cat, cat);
    for (const q of rows) categoryBySlug.set(q.titleSlug, cat);
    await sleep(PAGE_DELAY_MS);
  }

  const { list: curated, dupes } = dedupe(CURATED);
  if (dupes.length) console.log(`  merged ${dupes.length} duplicate slug(s): ${dupes.join(", ")}`);
  const curatedBySlug = new Map(curated.map((c) => [c.slug, c]));

  const include = all.filter((q) => !q.isPaidOnly || curatedBySlug.has(q.titleSlug));
  const premiumKept = include.filter((q) => q.isPaidOnly).length;
  console.log(
    `  ${all.length} problems, ${include.length} included ` +
      `(${all.length - include.length} premium-only excluded, ${premiumKept} premium kept because curated)`,
  );

  const validTopics = new Set<string>(TOPICS);
  const validPatterns = new Set<string>(PATTERNS);
  const validSheets = new Set<string>(SHEETS.map((s) => s.slug));

  const built: BuiltProblem[] = [];
  const ruleCounts = new Map<string, number>();
  const badTaxonomy: string[] = [];

  for (const q of include) {
    const c = curatedBySlug.get(q.titleSlug);

    let topic: string;
    let pattern: string;
    let taxonomy: TaxonomySource;

    if (c) {
      // Hand curation always wins over derivation.
      if (!validTopics.has(c.topic)) badTaxonomy.push(`${c.slug}: unknown topic "${c.topic}"`);
      if (!validPatterns.has(c.pattern)) badTaxonomy.push(`${c.slug}: unknown pattern "${c.pattern}"`);
      for (const s of c.sheets ?? []) {
        if (!validSheets.has(s)) badTaxonomy.push(`${c.slug}: unknown sheet "${s}"`);
      }
      topic = c.topic;
      pattern = c.pattern;
      taxonomy = "curated";
      ruleCounts.set("curated", (ruleCounts.get("curated") ?? 0) + 1);
    } else {
      const d = deriveTaxonomy({
        tags: q.topicTags.map((t) => t.slug),
        title: q.title,
        category: categoryBySlug.get(q.titleSlug),
      });
      topic = d.topic;
      pattern = d.pattern;
      taxonomy = "derived";
      ruleCounts.set(d.rule, (ruleCounts.get(d.rule) ?? 0) + 1);
    }

    built.push({
      slug: q.titleSlug,
      title: q.title,
      leetcodeId: Number(q.questionFrontendId),
      difficulty: DIFFICULTY[q.difficulty],
      url: `https://leetcode.com/problems/${q.titleSlug}/`,
      topic,
      pattern,
      taxonomy,
      sheets: c?.sheets ?? [],
      companies: c?.companies ?? [],
      acceptance: Math.round(q.acRate * 10) / 10,
      isPremium: q.isPaidOnly,
      order: c?.order ?? 999,
    });
  }

  // A curated slug that no longer exists on LeetCode (renamed or withdrawn) is
  // a real error in curated.ts, so fail loudly rather than silently dropping it.
  const builtSlugs = new Set(built.map((p) => p.slug));
  const missing = curated.filter((c) => !builtSlugs.has(c.slug)).map((c) => c.slug);
  if (missing.length) {
    console.error(`\n✗ ${missing.length} curated slug(s) not found among free LeetCode problems:`);
    for (const m of missing) {
      console.error(`    ${m}  (not on LeetCode — renamed or withdrawn)`);
    }
  }
  if (badTaxonomy.length) {
    console.error(`\n✗ taxonomy problems:`);
    for (const b of badTaxonomy) console.error(`    ${b}`);
  }
  if (missing.length || badTaxonomy.length) process.exit(1);

  built.sort((a, b) => a.leetcodeId - b.leetcodeId);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(built) + "\n", "utf8");

  // ── report ────────────────────────────────────────────────────────────────
  const byDiff = built.reduce<Record<string, number>>((acc, p) => {
    acc[p.difficulty] = (acc[p.difficulty] ?? 0) + 1;
    return acc;
  }, {});
  const derived = built.filter((p) => p.taxonomy === "derived").length;

  console.log(`\n✓ wrote ${built.length} problems → data/problems.json`);
  console.log(`  difficulty     ${JSON.stringify(byDiff)}`);
  console.log(`  taxonomy       ${built.length - derived} curated, ${derived} derived from LeetCode tags`);
  console.log(`  topics used    ${new Set(built.map((p) => p.topic)).size}/${TOPICS.length}`);
  console.log(`  patterns used  ${new Set(built.map((p) => p.pattern)).size}/${PATTERNS.length}`);
  console.log(
    `  sheets         ${SHEETS.map((s) => `${s.name}: ${built.filter((p) => p.sheets.includes(s.slug)).length}`).join(" | ")}`,
  );

  console.log(`\n  derivation rules that fired (audit these — an implausible bucket means a bad rule):`);
  for (const [rule, n] of [...ruleCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(5)}  ${rule}`);
  }

  const topicCounts = built.reduce<Record<string, number>>((acc, p) => {
    acc[p.topic] = (acc[p.topic] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\n  problems per topic:`);
  for (const [t, n] of Object.entries(topicCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(5)}  ${t}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
