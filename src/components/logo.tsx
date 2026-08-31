import { cn } from "@/lib/utils";

/**
 * The DSA Tracker mark: three graph nodes whose edges trace a checkmark.
 *
 * It has to carry both halves of what this app is — the node-link shape says
 * "data structures", the tick says "solved" — and it has to survive 16px in a
 * browser tab, which rules out anything with interior detail. Three filled
 * dots and two strokes is about the most that stays legible there.
 *
 * Drawn in `currentColor` so it inherits from whatever it sits in.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8.5 16.5 L13.8 22 L23.5 10" />
      <circle cx="8.5" cy="16.5" r="3.3" fill="currentColor" stroke="none" />
      <circle cx="13.8" cy="22" r="3.3" fill="currentColor" stroke="none" />
      <circle cx="23.5" cy="10" r="3.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * The mark in its accent-coloured tile — the form it takes almost everywhere
 * in the app. `size` drives the tile; the mark scales with it.
 */
export function LogoTile({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tile = {
    sm: "size-7 rounded-lg",
    md: "size-9 rounded-xl",
    lg: "size-11 rounded-2xl",
  }[size];

  const mark = { sm: "size-4", md: "size-5", lg: "size-6" }[size];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-[var(--accent)] text-[var(--accent-fg)]",
        tile,
        className,
      )}
    >
      <LogoMark className={mark} />
    </div>
  );
}

/** Mark plus wordmark, for headers and the sign-in page. */
export function Logo({
  size = "sm",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const text = { sm: "text-[0.9375rem]", md: "text-lg", lg: "text-xl" }[size];

  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoTile size={size} />
      <span className={cn("font-semibold tracking-tight", text)}>DSA Tracker</span>
    </span>
  );
}
