"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Loader2, Trash2 } from "lucide-react";
import { Card, CardHeader, Button, Input } from "@/components/ui/primitives";
import { exportProgressCsv, resetAllProgress } from "@/lib/actions";

export function DangerZone() {
  const [confirm, setConfirm] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [isPending, startTransition] = useTransition();

  const download = () => {
    startTransition(async () => {
      try {
        const csv = await exportProgressCsv();
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dsa-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Export downloaded");
      } catch {
        toast.error("Couldn't build the export");
      }
    });
  };

  const reset = () => {
    startTransition(async () => {
      try {
        await resetAllProgress();
        setShowReset(false);
        setConfirm("");
        toast.success("All progress cleared");
      } catch {
        toast.error("Couldn't reset your progress");
      }
    });
  };

  return (
    <Card>
      <CardHeader title="Export and reset" subtitle="Take your data with you, or start over" />

      <div className="space-y-3 px-5 pb-5">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] p-3">
          <div>
            <p className="text-[0.8125rem] font-medium">Export as CSV</p>
            <p className="text-xs text-[var(--fg-muted)]">
              Every tracked problem with status, timings, ratings and complexity notes.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={download} disabled={isPending}>
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Download
          </Button>
        </div>

        <div className="rounded-lg border border-[var(--hard)]/30 p-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[0.8125rem] font-medium text-[var(--hard)]">Reset all progress</p>
              <p className="text-xs text-[var(--fg-muted)]">
                Clears every status, rating, timer log and heatmap day. Your notes are kept.
              </p>
            </div>
            {!showReset && (
              <Button variant="danger" size="sm" onClick={() => setShowReset(true)}>
                <Trash2 className="size-3.5" />
                Reset
              </Button>
            )}
          </div>

          {showReset && (
            <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
              <p className="text-xs text-[var(--fg-muted)]">
                This cannot be undone. Type <span className="font-mono font-semibold">RESET</span>{" "}
                to confirm.
              </p>
              <div className="flex gap-2">
                <Input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="RESET"
                  className="font-mono"
                  autoFocus
                />
                <Button
                  variant="danger"
                  disabled={confirm !== "RESET" || isPending}
                  onClick={reset}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowReset(false);
                    setConfirm("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
