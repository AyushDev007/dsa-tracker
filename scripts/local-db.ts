/**
 * Zero-install local Postgres.
 *
 *   npm run db:local          # start (foreground, Ctrl+C to stop)
 *   npm run db:local -- stop  # stop a detached instance
 *
 * `embedded-postgres` ships a real PostgreSQL server binary and runs it out of
 * `.postgres/` in the project. No Docker, no admin rights, no cloud account —
 * but it *is* real Postgres, so the schema you develop against is byte-for-byte
 * the schema you deploy to Neon.
 *
 * In production this script is never used: `DATABASE_URL` points at Neon and
 * `embedded-postgres` stays a devDependency.
 */
import EmbeddedPostgres from "embedded-postgres";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA_DIR = resolve(ROOT, ".postgres");

const PORT = Number(process.env.LOCAL_DB_PORT ?? 5432);
const USER = "dsa";
const PASSWORD = "dsa";
const DATABASE = "dsa_tracker";

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
  // Without this, initdb inherits the Windows ANSI codepage (WIN1252) and the
  // server rejects any non-Latin-1 character the app stores — em dashes in
  // notes, emoji, non-English problem titles. Neon is UTF-8, so pinning it
  // here keeps local and production identical.
  initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-collate=C", "--lc-ctype=C"],
  onLog: () => {}, // Postgres is chatty on Windows; silence unless it fails.
  onError: (err) => console.error("[postgres]", err),
});

async function start() {
  const firstRun = !existsSync(DATA_DIR);
  if (firstRun) {
    console.log("→ initialising a fresh Postgres cluster in .postgres/ (one time only)");
    await pg.initialise();
  }

  console.log(`→ starting Postgres on port ${PORT}`);
  await pg.start();

  if (firstRun) {
    await pg.createDatabase(DATABASE);
    console.log(`→ created database "${DATABASE}"`);
  }

  const url = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}?schema=public`;
  console.log(`\n✓ Postgres is up.\n  DATABASE_URL="${url}"\n`);
  console.log("  Leave this running and use another terminal for `npm run dev`.");
  console.log("  Press Ctrl+C to stop.\n");

  const shutdown = async () => {
    console.log("\n→ stopping Postgres…");
    try {
      await pg.stop();
    } catch {
      /* already down */
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the process alive.
  setInterval(() => {}, 1 << 30);
}

async function stop() {
  console.log("→ stopping Postgres…");
  await pg.stop();
  console.log("✓ stopped");
}

const cmd = process.argv[2] ?? "start";
(cmd === "stop" ? stop() : start()).catch((err) => {
  console.error(err);
  process.exit(1);
});
