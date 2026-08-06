"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Play, Pause, Square, Lightbulb } from "lucide-react";
import { Card, CardHeader, Button } from "@/components/ui/primitives";
import { logAttempt } from "@/lib/actions";
import { cn, formatClock } from "@/lib/utils";

/**
 * Wall-clock timer for a solve sitting.
 *
 * Time is derived from timestamps rather than counted by the interval, so a
 * backgrounded tab (where browsers throttle timers to once a minute) still
 * reports the true elapsed time when you come back to it.
 */
export function SolveTimer({
  problemId,
  elapsed,
  onElapsedChange,
  usedHint,
  onUsedHintChange,
}: {
  problemId: string;
  elapsed: number;
  onElapsedChange: (seconds: number) => void;
  usedHint: boolean;
  onUsedHintChange: (v: boolean) => void;
}) {
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();
  const startedAt = useRef<number | null>(null);
  const baseline = useRef(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (startedAt.current === null) return;
      onElapsedChange(baseline.current + Math.floor((Date.now() - startedAt.current) / 1000));
    };
    const id = setInterval(tick, 1000);
    // Catch up immediately after the tab regains focus.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running, onElapsedChange]);

  const start = () => {
    baseline.current = elapsed;
    startedAt.current = Date.now();
    setRunning(true);
  };

  const pause = () => {
    if (startedAt.current !== null) {
      onElapsedChange(baseline.current + Math.floor((Date.now() - startedAt.current) / 1000));
    }
    startedAt.current = null;
    setRunning(false);
  };

  const stopAndLog = () => {
    if (running) pause();
    const seconds = elapsed;
    if (seconds < 5) {
      onElapsedChange(0);
      return;
    }
    startTransition(async () => {
      try {
        await logAttempt({ problemId, durationSec: seconds, solved: false, usedHint });
        toast.success(`Logged ${formatClock(seconds)} as an attempt`);
        onElapsedChange(0);
        onUsedHintChange(false);
      } catch {
        toast.error("Couldn't log that session");
      }
    });
  };

  return (
    <Card>
      <CardHeader
        title="Timer"
        subtitle={running ? "Running" : elapsed > 0 ? "Paused" : "Not started"}
      />
      <div className="px-5 pb-4">
        <p
          className={cn(
            "text-center font-mono text-3xl font-semibold tabular-nums transition-colors",
            running ? "text-[var(--accent)]" : "text-[var(--fg)]",
          )}
        >
          {formatClock(elapsed)}
        </p>

        <div className="mt-3 flex gap-1.5">
          {running ? (
            <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={pause}>
              <Pause className="size-3.5" />
              Pause
            </Button>
          ) : (
            <Button variant="primary" size="sm" className="flex-1 justify-center" onClick={start}>
              <Play className="size-3.5" />
              {elapsed > 0 ? "Resume" : "Start"}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="justify-center"
            disabled={elapsed === 0}
            onClick={stopAndLog}
            title="Stop and log as an attempt"
          >
            <Square className="size-3.5" />
            Log
          </Button>
        </div>

        <button
          onClick={() => onUsedHintChange(!usedHint)}
          className={cn(
            "mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            usedHint
              ? "border-[var(--medium)] bg-[var(--medium-soft)] text-[var(--medium)]"
              : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]",
          )}
        >
          <Lightbulb className={cn("size-3.5", usedHint && "fill-current")} />
          {usedHint ? "Used a hint" : "Mark that I used a hint"}
        </button>

        <p className="mt-2 text-center text-[0.6875rem] text-[var(--fg-subtle)]">
          Rating a solve below also records this time.
        </p>
      </div>
    </Card>
  );
}
