/**
 * Joins `data/curated.ts` against LeetCode's public problem list and writes
 * `data/problems.json`, which is what the Prisma seed actually reads.
 *
 * Run with:  npm run problems:build
 *
 * The generated JSON is committed, so seeding (and therefore `vercel build`)
 * never needs network access. Re-run this only when you edit the curated list.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CURATED, TOPICS, PATTERNS, SHEETS, type CuratedProblem } from "../data/curated";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "data/problems.json");

const LEETCODE_LIST = "https://leetcode.com/api/problems/all/";

type LeetCodeStat = {
  stat: {
    question_id: number;
    frontend_question_id: number;
    question__title: string;
    question__title_slug: string;
    total_acs: number;
    total_submitted: number;
  };
  difficulty: { level: 1 | 2 | 3 };
  paid_only: boolean;
};

const DIFFICULTY = { 1: "EASY", 2: "MEDIUM", 3: "HARD" } as const;

export type BuiltProblem = {
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
  console.log(`→ fetching ${LEETCODE_LIST}`);
  const res = await fetch(LEETCODE_LIST, {
    headers: { "user-agent": "dsa-tracker/1.0 (dataset build script)" },
  });
  if (!res.ok) throw new Error(`LeetCode returned ${res.status} ${res.statusText}`);

  const payload = (await res.json()) as { stat_status_pairs: LeetCodeStat[] };
  const index = new Map(payload.stat_status_pairs.map((s) => [s.stat.question__title_slug, s]));
  console.log(`  got ${index.size} problems from LeetCode`);

  const { list, dupes } = dedupe(CURATED);
  if (dupes.length) console.log(`  merged ${dupes.length} duplicate slug(s): ${dupes.join(", ")}`);

  const validTopics = new Set<string>(TOPICS);
  const validPatterns = new Set<string>(PATTERNS);
  const validSheets = new Set<string>(SHEETS.map((s) => s.slug));

  const built: BuiltProblem[] = [];
  const missing: string[] = [];
  const badTaxonomy: string[] = [];

  for (const c of list) {
    const hit = index.get(c.slug);
    if (!hit) {
      missing.push(c.slug);
      continue;
    }
    if (!validTopics.has(c.topic)) badTaxonomy.push(`${c.slug}: unknown topic "${c.topic}"`);
    if (!validPatterns.has(c.pattern)) badTaxonomy.push(`${c.slug}: unknown pattern "${c.pattern}"`);
    for (const s of c.sheets ?? []) {
      if (!validSheets.has(s)) badTaxonomy.push(`${c.slug}: unknown sheet "${s}"`);
    }

    const { stat, difficulty, paid_only } = hit;
    built.push({
      slug: c.slug,
      title: stat.question__title,
      leetcodeId: stat.frontend_question_id,
      difficulty: DIFFICULTY[difficulty.level],
      url: `https://leetcode.com/problems/${c.slug}/`,
      topic: c.topic,
      pattern: c.pattern,
      sheets: c.sheets ?? [],
      companies: c.companies ?? [],
      acceptance:
        stat.total_submitted > 0
          ? Math.round((stat.total_acs / stat.total_submitted) * 1000) / 10
          : 0,
      isPremium: paid_only,
      order: c.order ?? 999,
    });
  }

  if (missing.length) {
    console.error(`\n✗ ${missing.length} slug(s) not found on LeetCode — fix data/curated.ts:`);
    for (const m of missing) console.error(`    ${m}`);
  }
  if (badTaxonomy.length) {
    console.error(`\n✗ taxonomy problems:`);
    for (const b of badTaxonomy) console.error(`    ${b}`);
  }
  if (missing.length || badTaxonomy.length) process.exit(1);

  built.sort((a, b) => a.leetcodeId - b.leetcodeId);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(built, null, 2) + "\n", "utf8");

  const byDiff = built.reduce<Record<string, number>>((acc, p) => {
    acc[p.difficulty] = (acc[p.difficulty] ?? 0) + 1;
    return acc;
  }, {});
  const bySheet = SHEETS.map(
    (s) => `${s.name}: ${built.filter((p) => p.sheets.includes(s.slug)).length}`,
  );

  console.log(`\n✓ wrote ${built.length} problems → data/problems.json`);
  console.log(`  difficulty  ${JSON.stringify(byDiff)}`);
  console.log(`  topics      ${new Set(built.map((p) => p.topic)).size}`);
  console.log(`  patterns    ${new Set(built.map((p) => p.pattern)).size}`);
  console.log(`  premium     ${built.filter((p) => p.isPremium).length}`);
  console.log(`  sheets      ${bySheet.join(" | ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
