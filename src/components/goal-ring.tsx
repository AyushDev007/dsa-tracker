"use client";

import { cn } from "@/lib/utils";

/** Daily-goal progress ring. Overshooting the goal fills it and turns green. */
export function GoalRing({ done, goal }: { done: number; goal: number }) {
  const pct = goal > 0 ? Math.min(1, done / goal) : 0;
  const size = 116;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const complete = done >= goal;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-[var(--surface-2)]"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            className={cn(
              "transition-[stroke-dashoffset] duration-700 ease-out",
              complete ? "stroke-[var(--easy)]" : "stroke-[var(--accent)]",
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums leading-none">{done}</span>
          <span className="mt-0.5 text-xs text-[var(--fg-subtle)] tabular-nums">of {goal}</span>
        </div>
      </div>
      <p className="mt-3 text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--fg-subtle)]">
        Today&apos;s goal
      </p>
    </div>
  );
}
