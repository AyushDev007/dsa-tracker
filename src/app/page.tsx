import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Badge } from "@/components/ui/primitives";
import {
  Binary,
  Layers,
  RotateCcw,
  Flame,
  NotebookPen,
  BarChart3,
  Timer,
  Building2,
  Share2,
  ArrowRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: Layers,
    title: "Topic *and* pattern",
    body: "Every problem is tagged twice: the data structure it lives in, and the technique it teaches. Grind arrays one day, sliding window the next.",
  },
  {
    icon: RotateCcw,
    title: "Spaced repetition",
    body: "Rate a solve and it schedules itself to come back — 1 day, 3, 7, 21. A problem you understood in March is a problem you can still solve in June.",
  },
  {
    icon: Flame,
    title: "Heatmap and streaks",
    body: "A year of activity at a glance, built from your own solves and merged with your real LeetCode submission calendar.",
  },
  {
    icon: NotebookPen,
    title: "Notes that stick",
    body: "Markdown write-ups plus a syntax-highlighted solution per problem, with the complexity you worked out. Searchable later.",
  },
  {
    icon: BarChart3,
    title: "Weak-area detection",
    body: "Charts by topic and pattern that surface where you keep stalling, so revision targets the gap instead of the comfort zone.",
  },
  {
    icon: Timer,
    title: "Timer and attempt log",
    body: "Time each sitting, record whether you needed a hint, and watch your median solve time drop over weeks.",
  },
  {
    icon: Building2,
    title: "Company filters",
    body: "Narrow to what a specific company tends to ask when the interview is three weeks out.",
  },
  {
    icon: Share2,
    title: "Public profile",
    body: "An opt-in read-only page with your heatmap and stats. One link for a resume or a LinkedIn post.",
  },
];

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const [problemCount, topicCount, patternCount] = await Promise.all([
    prisma.problem.count(),
    prisma.topic.count(),
    prisma.pattern.count(),
  ]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-fg)]">
            <Binary className="size-4" />
          </div>
          <span className="font-semibold tracking-tight">DSA Tracker</span>
          <div className="flex-1" />
          <ThemeToggle />
          <Link href="/signin">
            <Button variant="primary" size="sm">
              Sign in
            </Button>
          </Link>
        </div>
      </header>

      {/* ── hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(900px circle at 50% -10%, var(--accent-soft), transparent 65%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:py-28">
          <Badge tone="accent" className="mb-5 px-2.5 py-1 text-xs">
            {problemCount} curated problems · {patternCount} patterns
          </Badge>

          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Stop re-solving the same problems and forgetting the rest.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-pretty text-[var(--fg-muted)]">
            A DSA tracker built around how interview prep actually fails: you solve something once,
            move on, and three weeks later it&apos;s gone. This one schedules problems back to you
            before that happens.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signin">
              <Button variant="primary" size="lg">
                Start tracking
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="lg">
                See what&apos;s inside
              </Button>
            </a>
          </div>

          <dl className="mx-auto mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-[var(--border)] pt-8">
            {[
              { label: "Problems", value: problemCount },
              { label: "Topics", value: topicCount },
              { label: "Patterns", value: patternCount },
            ].map((s) => (
              <div key={s.label}>
                <dt className="text-[0.6875rem] font-medium uppercase tracking-wider text-[var(--fg-subtle)]">
                  {s.label}
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── features ─────────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          Everything in one place
        </h2>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-[var(--fg-muted)]">
          Built to replace the spreadsheet, the Notion page, and the bookmarks folder.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--border-strong)]"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                <Icon className="size-4.5" />
              </div>
              <h3 className="mt-3.5 text-sm font-semibold">{title.replace(/\*/g, "")}</h3>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--fg-muted)]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── closing ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 pb-24 text-center">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10">
          <h2 className="text-xl font-semibold tracking-tight">
            Sign in with GitHub or Google and start where you are
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--fg-muted)]">
            Link your LeetCode username and everything you&apos;ve already solved gets marked off
            automatically.
          </p>
          <Link href="/signin" className="mt-6 inline-block">
            <Button variant="primary" size="lg">
              Get started
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-8">
        <p className="text-center text-xs text-[var(--fg-subtle)]">
          Problem metadata from LeetCode&apos;s public API. Not affiliated with LeetCode.
        </p>
      </footer>
    </div>
  );
}
