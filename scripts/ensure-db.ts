/**
 * Makes sure a local Postgres is listening before `next dev` starts.
 *
 * `npm run db:local` runs the server in the foreground, which works but means
 * two terminals and a database that dies whenever that terminal closes. This
 * script instead drives `pg_ctl` — the same binary `embedded-postgres` ships —
 * to start the cluster as a detached service that outlives this process.
 *
 * Idempotent: if something is already listening on the port, it does nothing.
 * Never used in production, where DATABASE_URL points at a managed database.
 */
import { spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA_DIR = resolve(ROOT, ".postgres");

// Deliberately OUTSIDE the data directory. Postgres fsyncs the whole data dir
// during crash recovery; on Windows it then collides with the log handle
// pg_ctl holds open ("sharing violation") and stalls startup by 30+ seconds.
const LOG_FILE = resolve(ROOT, ".postgres.log");

const PORT = Number(process.env.LOCAL_DB_PORT ?? 5432);

/** Resolve the platform-specific binary package embedded-postgres installed. */
function binDir(): string | null {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const platform =
    process.platform === "win32"
      ? `windows-${arch}`
      : process.platform === "darwin"
        ? `darwin-${arch}`
        : `linux-${arch}`;

  const dir = resolve(ROOT, "node_modules/@embedded-postgres", platform, "native/bin");
  return existsSync(dir) ? dir : null;
}

function isListening(port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((res) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const done = (ok: boolean) => {
      socket.destroy();
      res(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // A managed database (Neon, Supabase, any remote Postgres) needs nothing here.
  const url = process.env.DATABASE_URL ?? "";
  if (url && !/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    console.log("- DATABASE_URL points at a remote database; skipping local startup");
    return;
  }

  if (await isListening(PORT)) {
    console.log(`✓ Postgres already listening on ${PORT}`);
    return;
  }

  const bin = binDir();
  if (!bin) {
    console.error(
      `✗ No local Postgres binaries found, and nothing is listening on ${PORT}.\n` +
        `  Start a database another way:  npm run db:local   (or: docker compose up -d)`,
    );
    process.exit(1);
  }

  if (!existsSync(DATA_DIR)) {
    console.error(
      `✗ No database cluster in .postgres/\n\n` +
        `  Create and seed it once:\n` +
        `    npm run db:local     (leave running, then in another terminal)\n` +
        `    npm run setup`,
    );
    process.exit(1);
  }

  console.log(`→ starting Postgres on port ${PORT}...`);

  const pgCtl = resolve(bin, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl");

  // stdio must be "ignore", not "pipe". pg_ctl exits immediately, but the
  // detached postgres it spawned inherits the pipe and never closes it — so
  // spawnSync would block forever on a server that is already up and healthy.
  // Poll the port instead, and read the log only to explain a failure.
  const result = spawnSync(pgCtl, ["-D", DATA_DIR, "-l", LOG_FILE, "-o", `-p ${PORT}`, "start"], {
    stdio: "ignore",
  });

  if (result.error) {
    console.error(`✗ Could not run pg_ctl: ${result.error.message}`);
    process.exit(1);
  }

  // A cold start takes a second or two; recovery after an unclean shutdown can
  // take considerably longer, so wait generously before giving up.
  const deadline = Date.now() + 90_000;
  let up = false;
  while (Date.now() < deadline) {
    if (await isListening(PORT, 800)) {
      up = true;
      break;
    }
    await sleep(500);
  }

  if (!up) {
    console.error(`✗ Postgres did not come up on ${PORT} within 90s.`);
    if (existsSync(LOG_FILE)) {
      const tail = readFileSync(LOG_FILE, "utf8").trim().split(/\r?\n/).slice(-15).join("\n");
      console.error(`\n--- ${LOG_FILE} ---\n${tail}`);
    }
    process.exit(1);
  }

  console.log(`✓ Postgres up on ${PORT} (detached — stop it with: npm run db:stop)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
