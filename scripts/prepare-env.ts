/**
 * Normalises database environment variables at build time.
 *
 * Attaching a Postgres database from Vercel's Storage tab injects its own
 * variable names (DATABASE_URL, DATABASE_URL_UNPOOLED, POSTGRES_PRISMA_URL,
 * POSTGRES_URL_NON_POOLING, …) depending on the provider. Prisma's schema can
 * only read one fixed name each for the pooled and direct URLs, so without this
 * you have to hand-copy connection strings into a second set of variables and
 * the build fails confusingly when you don't.
 *
 * This maps whatever was injected onto DATABASE_URL / DIRECT_URL and writes
 * them to .env, which the Prisma CLI reads. It only ever runs on Vercel — a
 * local .env is never touched.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = resolve(__dirname, "..", ".env");

const first = (...names: string[]): string | undefined => {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
};

if (!process.env.VERCEL) {
  console.log("- not running on Vercel; leaving environment untouched");
  process.exit(0);
}

const pooled = first(
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "DATABASE_POSTGRES_URL",
);

// Migrations cannot run through a connection pooler, so prefer an explicitly
// unpooled URL and fall back to the pooled one only as a last resort.
const direct = first(
  "DIRECT_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_POSTGRES_URL_NON_POOLING",
);

if (!pooled) {
  console.error(
    "✗ No database connection string found.\n\n" +
      "  Set DATABASE_URL in the Vercel project's Environment Variables, or\n" +
      "  attach a Postgres database from the project's Storage tab.",
  );
  process.exit(1);
}

const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
const lines: string[] = [];

if (!/^DATABASE_URL=/m.test(existing)) lines.push(`DATABASE_URL="${pooled}"`);
if (!/^DIRECT_URL=/m.test(existing)) lines.push(`DIRECT_URL="${direct ?? pooled}"`);

if (lines.length) {
  appendFileSync(ENV_FILE, (existing && !existing.endsWith("\n") ? "\n" : "") + lines.join("\n") + "\n");
}

const host = (() => {
  try {
    return new URL(pooled).host;
  } catch {
    return "unparseable";
  }
})();

console.log(`✓ database configured (${host})`);
if (!direct) {
  console.log("  note: no unpooled URL found — migrations will use the pooled one.");
  console.log("  If they fail, set DIRECT_URL to the provider's direct connection string.");
}
