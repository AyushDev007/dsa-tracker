export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const STATUSES = ["TODO", "ATTEMPTED", "SOLVED"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  TODO: "To do",
  ATTEMPTED: "Attempted",
  SOLVED: "Solved",
};

/**
 * Spaced-repetition ladder, in days.
 *
 * Rating a solve "confident" advances one rung; "ok" repeats the current rung;
 * "struggled" drops back to the start. Deliberately coarse — this is a study
 * aid, not SM-2, and a schedule you can predict in your head is one you'll
 * actually trust.
 */
export const REVIEW_INTERVALS = [1, 3, 7, 21, 45, 90] as const;

export const CONFIDENCE = {
  1: { label: "Struggled", hint: "Needed the solution or a big hint", tone: "danger" },
  2: { label: "OK", hint: "Got there, but slowly", tone: "warn" },
  3: { label: "Confident", hint: "Clean solve, would repeat in an interview", tone: "ok" },
} as const;

export type ConfidenceValue = keyof typeof CONFIDENCE;

export const LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "csharp", label: "C#" },
  { value: "kotlin", label: "Kotlin" },
] as const;

export const PAGE_SIZE = 50;
