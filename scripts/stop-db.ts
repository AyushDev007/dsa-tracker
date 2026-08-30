/**
 * Stops the detached local Postgres started by `scripts/ensure-db.ts`.
 *   npm run db:stop
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA_DIR = resolve(ROOT, ".postgres");

function binDir(): string | null {
  const platform =
    process.platform === "win32"
      ? `windows-${process.arch === "arm64" ? "arm64" : "x64"}`
      : process.platform === "darwin"
        ? `darwin-${process.arch === "arm64" ? "arm64" : "x64"}`
        : `linux-${process.arch === "arm64" ? "arm64" : "x64"}`;
  const dir = resolve(ROOT, "node_modules/@embedded-postgres", platform, "native/bin");
  return existsSync(dir) ? dir : null;
}

const bin = binDir();
if (!bin || !existsSync(DATA_DIR)) {
  console.log("Nothing to stop — no local cluster found.");
  process.exit(0);
}

const pgCtl = resolve(bin, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl");
const r = spawnSync(pgCtl, ["-D", DATA_DIR, "-m", "fast", "-w", "-t", "30", "stop"], {
  encoding: "utf8",
  stdio: "pipe",
});

if (r.status === 0) console.log("✓ Postgres stopped");
else console.log(`Postgres was not running.\n${r.stderr ?? ""}`.trim());
