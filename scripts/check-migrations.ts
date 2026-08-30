/**
 * Guards against non-SQL text leaking into a migration file.
 *
 * `prisma migrate diff --script > file.sql` also captures Prisma's CLI warnings
 * on stdout, which then get executed as SQL and fail the deploy with a cryptic
 * `syntax error at or near "warn"`. Always use `--output`, and let this catch
 * it if anyone forgets.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(__dirname, "..", "prisma", "migrations");

if (!existsSync(MIGRATIONS)) {
  console.log("- no migrations directory; nothing to check");
  process.exit(0);
}

const problems: string[] = [];

for (const dir of readdirSync(MIGRATIONS, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const file = join(MIGRATIONS, dir.name, "migration.sql");
  if (!existsSync(file)) continue;

  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const [i, line] of lines.entries()) {
    const t = line.trim();
    if (!t) continue;
    // The first meaningful line must look like SQL or a SQL comment.
    if (/^(--|\/\*)/.test(t)) break;
    if (/^[A-Za-z]+\s/.test(t) && /^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SET|BEGIN|COMMIT|GRANT|COMMENT|DO|SELECT|WITH)\b/i.test(t)) break;
    problems.push(`${dir.name}/migration.sql:${i + 1}  ${t.slice(0, 90)}`);
    break;
  }
}

if (problems.length) {
  console.error("✗ Migration files contain non-SQL text at the top:\n");
  for (const p of problems) console.error(`   ${p}`);
  console.error(
    "\n  This is almost always CLI output captured by a shell redirect.\n" +
      "  Regenerate with --output instead of `>`:\n\n" +
      "    prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma \\n" +
      "      --script --output prisma/migrations/<name>/migration.sql\n",
  );
  process.exit(1);
}

console.log("✓ migration files look like SQL");
