"use client";

import { useOptimistic, useTransition } from "react";
import { Check, Minus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Status } from "@/lib/constants";

const ORDER: Status[] = ["TODO", "ATTEMPTED", "SOLVED"];

const LABEL: Record<Status, string> = {
  TODO: "Not started — click to mark attempted",
  ATTEMPTED: "Attempted — click to mark solved",
  SOLVED: "Solved — click to reset",
};

/**
 * The one-click status control in the problem list. Cycles
 * to do → attempted → solved → to do, with the write applied optimistically so
 * ticking off a run of problems never feels laggy.
 */
export function StatusCycler({
  problemId: _problemId,
  status,
  onChange,
  size = "md",
}: {
  problemId: string;
  status: Status | string;
  onChange: (next: Status) => Promise<void>;
  size?: "md" | "lg";
}) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(status as Status);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(optimistic) + 1) % ORDER.length];
    startTransition(async () => {
      setOptimistic(next);
      try {
        await onChange(next);
      } catch {
        toast.error("Couldn't save that. Check your connection.");
      }
    });
  };

  const box = size === "lg" ? "size-7" : "size-5";
  const icon = size === "lg" ? "size-4" : "size-3";

  return (
    <button
      onClick={cycle}
      title={LABEL[optimistic]}
      aria-label={LABEL[optimistic]}
      className={cn(
        "flex items-center justify-center rounded-md border-2 transition-all duration-150",
        box,
        optimistic === "SOLVED" &&
          "border-[var(--easy)] bg-[var(--easy)] text-white hover:brightness-110",
        optimistic === "ATTEMPTED" &&
          "border-[var(--medium)] bg-[var(--medium)] text-white hover:brightness-110",
        optimistic === "TODO" &&
          "border-[var(--border-strong)] bg-transparent hover:border-[var(--accent)]",
      )}
    >
      {optimistic === "SOLVED" && <Check className={cn(icon, "stroke-[3]")} />}
      {optimistic === "ATTEMPTED" && <Minus className={cn(icon, "stroke-[3]")} />}
    </button>
  );
}
