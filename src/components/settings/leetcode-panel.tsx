"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Link2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, Button, Input, Label, Badge } from "@/components/ui/primitives";
import { updateSettings, syncLeetCode } from "@/lib/actions";
import { relativeTime } from "@/lib/utils";

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
} | null;

export function LeetCodePanel({ username, sync }: { username: string; sync: Sync }) {
  const [value, setValue] = useState(username);
  const [autoMark, setAutoMark] = useState(true);
  const [isPending, startTransition] = useTransition();

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
              ? `${res.marked} tracker problem${res.marked === 1 ? "" : "s"} marked solved from your recent submissions.`
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
        subtitle="Public profile data only — no password, no session cookie, nothing that can touch your account"
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
              Mark tracked problems solved from my recent submissions
            </span>
            <span className="block text-xs text-[var(--fg-muted)]">
              LeetCode only exposes your ~20 most recent accepted submissions publicly, so this
              catches up gradually rather than all at once. It never un-marks anything.
            </span>
          </span>
        </label>

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
