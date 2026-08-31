/**
 * Clears migration rows that failed without applying a single statement.
 *
 * When `prisma migrate deploy` fails, it leaves a row in `_prisma_migrations`
 * and every later deploy aborts with P3009 until someone clears it by hand.
 * That is the right default — a half-applied migration must not be silently
 * retried, because the database is in an unknown state.
 *
 * But `applied_steps_count = 0` says the migration failed on its very first
 * statement, so nothing was written and there is no partial state to protect.
 * Retrying is safe, and making a human open a SQL console to delete one row
 * is pure friction.
 *
 * Deliberately narrow. It only removes rows that are ALL of:
 *   - unfinished        (finished_at IS NULL)
 *   - not already rolled back
 *   - zero steps applied (applied_steps_count = 0)
 *
 * Anything that got even one statement in is left alone and still blocks the
 * deploy, exactly as Prisma intends.
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  try {
    const exists = await prisma.$queryRawUnsafe<{ present: boolean }[]>(
      `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`,
    );
    if (!exists[0]?.present) {
      console.log("- no migration history yet; nothing to heal");
      return;
    }

    const stuck = await prisma.$queryRawUnsafe<
      { migration_name: string; applied_steps_count: number }[]
    >(
      `SELECT migration_name, applied_steps_count
         FROM "_prisma_migrations"
        WHERE finished_at IS NULL
          AND rolled_back_at IS NULL`,
    );

    if (stuck.length === 0) {
      console.log("✓ no failed migrations to clear");
      return;
    }

    const safe = stuck.filter((m) => Number(m.applied_steps_count) === 0);
    const unsafe = stuck.filter((m) => Number(m.applied_steps_count) > 0);

    for (const m of unsafe) {
      console.error(
        `✗ ${m.migration_name} failed after applying ${m.applied_steps_count} step(s).\n` +
          `  The database may be partially migrated, so this will not be cleared\n` +
          `  automatically. Inspect it and resolve with:\n` +
          `    prisma migrate resolve --rolled-back ${m.migration_name}`,
      );
    }

    if (safe.length) {
      const deleted = await prisma.$executeRawUnsafe(
        `DELETE FROM "_prisma_migrations"
          WHERE finished_at IS NULL
            AND rolled_back_at IS NULL
            AND applied_steps_count = 0`,
      );
      console.log(
        `✓ cleared ${deleted} failed migration record(s) that applied no changes: ` +
          safe.map((m) => m.migration_name).join(", "),
      );
    }

    if (unsafe.length) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // Never let this step be the reason a deploy fails; migrate deploy will
  // report the real problem a moment later with a better message.
  console.error(`- could not check migration history: ${err instanceof Error ? err.message : err}`);
});
