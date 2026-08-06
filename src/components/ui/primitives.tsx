import * as React from "react";
import { cn } from "@/lib/utils";
import type { Difficulty, Status } from "@/lib/constants";

/* ─────────────────────────────────────────────────────────────── Button ─── */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
};

const BUTTON_VARIANTS = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-fg)] hover:brightness-110 active:brightness-95 shadow-sm",
  secondary:
    "bg-[var(--surface-2)] text-[var(--fg)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)]",
  outline:
    "border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]",
  ghost: "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]",
  danger: "bg-[var(--hard)] text-white hover:brightness-110",
} as const;

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-[0.8125rem] gap-1.5",
  md: "h-9.5 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-[0.9375rem] gap-2",
  icon: "h-9 w-9 justify-center",
} as const;

export function Button({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center rounded-lg font-medium transition-all duration-150",
        "disabled:pointer-events-none disabled:opacity-45",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

/* ───────────────────────────────────────────────────────────────── Card ─── */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-[0.8125rem] text-[var(--fg-muted)]">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── Badge ─── */

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent" | "easy" | "medium" | "hard" | "outline";
}) {
  const tones = {
    neutral: "bg-[var(--surface-2)] text-[var(--fg-muted)] border-[var(--border)]",
    accent: "bg-[var(--accent-soft)] text-[var(--accent)] border-transparent",
    easy: "bg-[var(--easy-soft)] text-[var(--easy)] border-transparent",
    medium: "bg-[var(--medium-soft)] text-[var(--medium)] border-transparent",
    hard: "bg-[var(--hard-soft)] text-[var(--hard)] border-transparent",
    outline: "border-[var(--border)] text-[var(--fg-muted)]",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const tone = { EASY: "easy", MEDIUM: "medium", HARD: "hard" } as const;
  const label = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" } as const;
  const d = difficulty as Difficulty;
  return <Badge tone={tone[d] ?? "neutral"}>{label[d] ?? difficulty}</Badge>;
}

export function StatusDot({ status }: { status: Status | string }) {
  const styles: Record<string, string> = {
    SOLVED: "bg-[var(--easy)]",
    ATTEMPTED: "bg-[var(--medium)]",
    TODO: "bg-transparent border border-[var(--border-strong)]",
  };
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", styles[status] ?? styles.TODO)}
    />
  );
}

/* ────────────────────────────────────────────────────────── Form inputs ─── */

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm",
        "placeholder:text-[var(--fg-subtle)] transition-colors",
        "hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:outline-none",
        "focus:ring-2 focus:ring-[var(--ring)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm",
        "placeholder:text-[var(--fg-subtle)] transition-colors resize-y",
        "hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:outline-none",
        "focus:ring-2 focus:ring-[var(--ring)]",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9.5 w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface)]",
        "px-3 pr-8 text-sm transition-colors cursor-pointer",
        "hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:outline-none",
        "focus:ring-2 focus:ring-[var(--ring)]",
        "bg-[image:var(--chevron)] bg-[length:16px] bg-[position:right_0.6rem_center] bg-no-repeat",
        className,
      )}
      style={{
        // Inline so the arrow can pick up currentColor in both themes.
        ["--chevron" as string]:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-[0.8125rem] font-medium text-[var(--fg-muted)]", className)}
      {...props}
    />
  );
}

/* ──────────────────────────────────────────────────────────────── Misc ──── */

export function ProgressBar({
  value,
  total,
  className,
  tone = "accent",
}: {
  value: number;
  total: number;
  className?: string;
  tone?: "accent" | "easy" | "medium" | "hard";
}) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  const colors = {
    accent: "bg-[var(--accent)]",
    easy: "bg-[var(--easy)]",
    medium: "bg-[var(--medium)]",
    hard: "bg-[var(--hard)]",
  } as const;

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", colors[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-3 text-[var(--fg-subtle)]">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[0.8125rem] text-[var(--fg-muted)]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "easy" | "medium" | "hard" | "accent";
}) {
  const colors = {
    easy: "text-[var(--easy)]",
    medium: "text-[var(--medium)]",
    hard: "text-[var(--hard)]",
    accent: "text-[var(--accent)]",
  };
  return (
    <div>
      <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--fg-subtle)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
          tone && colors[tone],
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{hint}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-[var(--surface-2)]", className)} />;
}
