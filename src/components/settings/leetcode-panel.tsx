"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Link2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { Card, CardHeader, Button, Input, Label, Badge } from "@/components/ui/primitives";
import {
  updateSettings,
  syncLeetCode,
  saveLeetCodeCookie,
  clearLeetCodeCookie,
} from "@/lib/actions";
import { relativeTime, cn } from "@/lib/utils";

type Sync = {
  username: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  ranking: number | null;
  contestRating: number | null;
  lastSyncedAt: string;
  lastError: string | null;
  /** Whether a session cookie is stored — never the cookie itself. */
  hasCookie: boolean;
  cookieInvalid: boolean;
  fullSyncAt: string | null;
  fullSyncSolved: number | null;
} | null;

export function LeetCodePanel({ username, sync }: { username: string; sync: Sync }) {
  const [value, setValue] = useState(username);
  const [autoMark, setAutoMark] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [showCookie, setShowCookie] = useState(false);
  const [cookie, setCookie] = useState("");
  const [csrf, setCsrf] = useState("");

  const fullSync = Boolean(sync?.hasCookie && !sync.cookieInvalid);

  const saveCookie = () => {
    startTransition(async () => {
      try {
        const res = await saveLeetCodeCookie({ session: cookie.trim(), csrf: csrf.trim() || null });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setCookie("");
        setCsrf("");
        setShowCookie(false);
        toast.success(`Full sync enabled — LeetCode reports ${res.solvedOnLeetCode} solved`, {
          description: "Run a sync to tick every one of them in the tracker.",
        });
      } catch {
        toast.error("Couldn't verify that cookie. Try again in a moment.");
      }
    });
  };

  const forgetCookie = () => {
    startTransition(async () => {
      await clearLeetCodeCookie();
      toast.success("Session cookie forgotten", {
        description: "Syncing continues from your public profile, capped at 20 recent solves.",
      });
    });
  };

  const saveAndSync = () => {
    startTransition(async () => {
      try {
        const saved = await updateSettings({ leetcodeUsername: value.trim() || null });
        if (!saved.ok) {
          toast.error(saved.error);
          return;
        }
        if (!value.trim()) {
          toast.success("LeetCode account unlinked");
          return;
        }

        const res = await syncLeetCode({ autoMark });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(
          `Synced @${res.profile.username} — ${res.profile.totalSolved} solved on LeetCode`,
          {
            description: res.marked
              ? `${res.marked} tracker problem${res.marked === 1 ? "" : "s"} marked solved` +
                (res.mode === "full"
                  ? " from your full LeetCode history."
                  : " from your 20 most recent submissions.")
              : res.mode === "full"
                ? "Everything LeetCode reports solved was already ticked here."
                : "Your submission calendar is now merged into the heatmap.",
          },
        );
      } catch {
        toast.error("Sync failed. Try again in a moment.");
      }
    });
  };

  return (
    <Card>
      <CardHeader
        title="LeetCode"
        subtitle={
          fullSync
            ? "Full sync — your session cookie is stored encrypted and used only to read your solved list"
            : "Public profile data only — no password, no session cookie, nothing that can touch your account"
        }
        action={
          sync && !sync.lastError ? (
            <Badge tone="easy">
              <CheckCircle2 className="size-3" />
              Linked
            </Badge>
          ) : null
        }
      />

      <div className="space-y-4 px-5 pb-5">
        <div>
          <Label htmlFor="lc">LeetCode username</Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              id="lc"
              value={value}
              onChange={(e) => setValue(e.target.value.trim())}
              placeholder="your-leetcode-handle"
              onKeyDown={(e) => e.key === "Enter" && saveAndSync()}
            />
            <Button variant="primary" onClick={saveAndSync} disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : sync ? (
                <RefreshCw className="size-4" />
              ) : (
                <Link2 className="size-4" />
              )}
              {sync ? "Re-sync" : "Link"}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-[var(--fg-subtle)]">
            The name in your profile URL: leetcode.com/u/<span className="font-mono">username</span>
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3 transition-colors hover:border-[var(--border-strong)]">
          <input
            type="checkbox"
            checked={autoMark}
            onChange={(e) => setAutoMark(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />
          <span>
            <span className="block text-[0.8125rem] font-medium">
              Mark tracker problems solved from LeetCode
            </span>
            <span className="block text-xs text-[var(--fg-muted)]">
              {fullSync
                ? "Every problem LeetCode records as accepted gets ticked, however long ago you solved it. It never un-marks anything."
                : "Without a session cookie LeetCode exposes only your ~20 most recent accepted submissions, so this catches up gradually rather than all at once. It never un-marks anything."}
            </span>
          </span>
        </label>

        {/* ── full sync ────────────────────────────────────────────────── */}
        <div className="rounded-lg border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setShowCookie((v) => !v)}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
          >
            {fullSync ? (
              <ShieldCheck className="size-4 shrink-0 text-[var(--easy)]" />
            ) : (
              <KeyRound className="size-4 shrink-0 text-[var(--fg-subtle)]" />
            )}
            <span className="flex-1">
              <span className="block text-[0.8125rem] font-medium">
                {fullSync ? "Full history sync is on" : "Sync my full solve history"}
              </span>
              <span className="block text-xs text-[var(--fg-muted)]">
                {sync?.cookieInvalid
                  ? "Your session cookie expired — paste a fresh one to re-enable it."
                  : fullSync
                    ? sync?.fullSyncAt
                      ? `Last full sweep ${relativeTime(sync.fullSyncAt)}` +
                        (sync.fullSyncSolved ? ` · ${sync.fullSyncSolved} solved on LeetCode` : "")
                      : "Run a sync to import everything you have already solved."
                    : "Requires your LeetCode session cookie. Read what that means first."}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-[var(--fg-subtle)] transition-transform",
                showCookie && "rotate-180",
              )}
            />
          </button>

          {showCookie && (
            <div className="animate-rise space-y-3 border-t border-[var(--border)] px-3 py-3">
              <div className="space-y-2 text-xs text-[var(--fg-muted)]">
                <p>
                  LeetCode caps its public feed at your <strong>20 most recent</strong> accepted
                  submissions, and that cap is enforced on their server — asking for more returns
                  20. So nothing but your own session cookie can tell this app what you solved
                  last year.
                </p>
                <p className="rounded-md border border-[var(--medium)]/30 bg-[var(--medium-soft)] px-2.5 py-2 text-[var(--fg)]">
                  <strong>Understand what you are pasting.</strong> A LEETCODE_SESSION cookie is a
                  live credential: anyone holding it can act as you on leetcode.com until it
                  expires. This app encrypts it before storing it, sends it only to leetcode.com,
                  and never shows it again — but only paste it into an instance you control, and
                  sign out of LeetCode to invalidate it if you ever change your mind.
                </p>
                <details className="rounded-md border border-[var(--border)] px-2.5 py-2">
                  <summary className="cursor-pointer font-medium text-[var(--fg)]">
                    Where to find it
                  </summary>
                  <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                    <li>Sign in at leetcode.com in your browser.</li>
                    <li>
                      Open DevTools (F12) → <strong>Application</strong> →{" "}
                      <strong>Cookies</strong> → https://leetcode.com
                    </li>
                    <li>
                      Copy the value of <span className="font-mono">LEETCODE_SESSION</span>, and
                      optionally <span className="font-mono">csrftoken</span>.
                    </li>
                  </ol>
                </details>
              </div>

              <Input
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                placeholder="LEETCODE_SESSION value"
                type="password"
                autoComplete="off"
                spellCheck={false}
                aria-label="LeetCode session cookie"
              />
              <Input
                value={csrf}
                onChange={(e) => setCsrf(e.target.value)}
                placeholder="csrftoken (optional)"
                type="password"
                autoComplete="off"
                spellCheck={false}
                aria-label="LeetCode csrf token"
              />

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={saveCookie}
                  disabled={isPending || cookie.trim().length < 20}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  Verify and enable
                </Button>
                {sync?.hasCookie && (
                  <Button variant="secondary" onClick={forgetCookie} disabled={isPending}>
                    <Trash2 className="size-4" />
                    Forget cookie
                  </Button>
                )}
              </div>
              <p className="text-[0.6875rem] text-[var(--fg-subtle)]">
                The cookie is checked against LeetCode before it is saved, so a wrong paste fails
                here rather than silently doing nothing.
              </p>
            </div>
          )}
        </div>

        {sync?.lastError && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--hard)]/30 bg-[var(--hard-soft)] px-3 py-2.5 text-[0.8125rem] text-[var(--hard)]">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Last sync failed: {sync.lastError}
            </span>
          </div>
        )}

        {sync && !sync.lastError && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="flex items-baseline justify-between">
              <a
                href={`https://leetcode.com/u/${sync.username}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[0.8125rem] font-medium hover:text-[var(--accent)]"
              >
                @{sync.username}
              </a>
              <span className="text-[0.6875rem] text-[var(--fg-subtle)]">
                synced {relativeTime(sync.lastSyncedAt)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-3">
              <Metric label="Solved" value={sync.totalSolved} />
              <Metric label="Easy" value={sync.easySolved} tone="easy" />
              <Metric label="Medium" value={sync.mediumSolved} tone="medium" />
              <Metric label="Hard" value={sync.hardSolved} tone="hard" />
            </div>

            {(sync.ranking || sync.contestRating) && (
              <div className="mt-3 flex gap-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--fg-muted)]">
                {sync.ranking && (
                  <span>
                    Global rank <span className="font-semibold tabular-nums">#{sync.ranking.toLocaleString()}</span>
                  </span>
                )}
                {sync.contestRating && (
                  <span>
                    Contest rating{" "}
                    <span className="font-semibold tabular-nums">{sync.contestRating}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "easy" | "medium" | "hard";
}) {
  return (
    <div>
      <p className="text-[0.625rem] uppercase tracking-wider text-[var(--fg-subtle)]">{label}</p>
      <p
        className="text-base font-semibold tabular-nums"
        style={tone ? { color: `var(--${tone})` } : undefined}
      >
        {value}
      </p>
    </div>
  );
}
