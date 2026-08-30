/**
 * Normalises database environment variables at build time.
 *
 * Attaching Postgres from Vercel's Storage tab injects provider-specific
 * variable names — DATABASE_URL / DATABASE_URL_UNPOOLED normally, or
 * <PREFIX>_URL / <PREFIX>_URL_UNPOOLED when the project already had a
 * DATABASE_URL and you were forced to pick a custom prefix. Prisma's schema can
 * only read one fixed name for each of the pooled and direct URLs.
 *
 * So: find whatever Postgres URLs exist under any of those names, pick the best
 * pooled and direct ones, and write them to .env for the Prisma CLI to read.
 * Only ever runs on Vercel — a local .env is never touched.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = resolve(__dirname, "..", ".env");

const isPostgres = (v: string) => /^postgres(ql)?:\/\//i.test(v);

/**
 * A localhost URL on a build server is always wrong — it points at whatever
 * machine ran the build, not a reachable database. A stale local DATABASE_URL
 * left in the project settings is a common way to get a confusing failure, so
 * skip those outright rather than letting one shadow the real database.
 */
const isLocal = (v: string) => /@(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)[:/]/i.test(v);

/** Names that mean "safe for migrations" — a pooler cannot run DDL. */
const UNPOOLED = /(UNPOOLED|NON_POOLING|NONPOOLING|DIRECT)/i;

type Candidate = { name: string; url: string; unpooled: boolean };

function findCandidates(): { usable: Candidate[]; skippedLocal: string[] } {
  const usable: Candidate[] = [];
  const skippedLocal: string[] = [];

  for (const [name, raw] of Object.entries(process.env)) {
    const url = raw?.trim();
    if (!url || !isPostgres(url)) continue;
    // Only consider variables that look like connection-string slots.
    if (!/(_URL|^DATABASE_URL$|^DIRECT_URL$)/i.test(name)) continue;

    if (isLocal(url)) {
      skippedLocal.push(name);
      continue;
    }
    usable.push({ name, url, unpooled: UNPOOLED.test(name) });
  }
  return { usable, skippedLocal };
}

/** Prefer the conventional names, then anything else that fits. */
function rank(name: string, preferred: string[]) {
  const i = preferred.findIndex((p) => p.toUpperCase() === name.toUpperCase());
  return i === -1 ? preferred.length : i;
}

function main() {
  if (!process.env.VERCEL) {
    console.log("- not running on Vercel; leaving environment untouched");
    return;
  }

  const { usable, skippedLocal } = findCandidates();

  for (const name of skippedLocal) {
    console.log(`  ignoring ${name}: points at localhost, unreachable from a build server`);
  }

  const pooledPool = usable.filter((c) => !c.unpooled);
  const directPool = usable.filter((c) => c.unpooled);

  const pooled = [...pooledPool]
    .sort(
      (a, b) =>
        rank(a.name, ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"]) -
        rank(b.name, ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"]),
    )
    .at(0);

  const direct = [...directPool]
    .sort(
      (a, b) =>
        rank(a.name, ["DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]) -
        rank(b.name, ["DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]),
    )
    .at(0);

  // With only an unpooled URL available, use it for both rather than failing.
  const app = pooled ?? direct;

  if (!app) {
    console.error(
      "\n✗ No usable Postgres connection string found.\n\n" +
        (skippedLocal.length
          ? `  Found ${skippedLocal.join(", ")}, but ${skippedLocal.length > 1 ? "they point" : "it points"} at localhost.\n` +
            "  Remove that variable in Settings -> Environment Variables.\n\n"
          : "") +
        "  Attach a database from the project's Storage tab, or set DATABASE_URL\n" +
        "  to a reachable Postgres connection string.",
    );
    process.exit(1);
  }

  const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const lines: string[] = [];
  if (!/^DATABASE_URL=/m.test(existing)) lines.push(`DATABASE_URL="${app.url}"`);
  if (!/^DIRECT_URL=/m.test(existing)) lines.push(`DIRECT_URL="${(direct ?? app).url}"`);

  if (lines.length) {
    const sep = existing && !existing.endsWith("\n") ? "\n" : "";
    appendFileSync(ENV_FILE, sep + lines.join("\n") + "\n");
  }

  const host = (() => {
    try {
      return new URL(app.url).host;
    } catch {
      return "unparseable host";
    }
  })();

  console.log(`✓ database configured from ${app.name} (${host})`);
  if (direct) console.log(`  migrations will use ${direct.name}`);
  else console.log("  no unpooled URL found; migrations will use the pooled connection");
}

main();
