"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, ExternalLink, Lock } from "lucide-react";
import type { ProblemListItem } from "@/lib/queries";
import { setStatus } from "@/lib/actions";
import { DifficultyBadge, ProgressBar } from "@/components/ui/primitives";
import { cn, percent } from "@/lib/utils";
import { StatusCycler } from "./status-cycler";

/**
 * The "by topic" / "by pattern" view — an accordion of groups, each with its
 * own completion bar. Groups you've already finished collapse by default so the
 * page opens on the work that's left.
 */
export function GroupedProblems({
  problems,
  groupBy,
}: {
  problems: ProblemListItem[];
  groupBy: "topic" | "pattern";
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; slug: string; items: ProblemListItem[] }>();
    for (const p of problems) {
      const key = groupBy === "topic" ? p.topic.slug : p.pattern.slug;
      const name = groupBy === "topic" ? p.topic.name : p.pattern.name;
      if (!map.has(key)) map.set(key, { name, slug: key, items: [] });
      map.get(key)!.items.push(p);
    }
    return [...map.values()];
  }, [problems, groupBy]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    // Start with completed groups folded away.
    const done = new Set<string>();
    const map = new Map<string, { total: number; solved: number }>();
    for (const p of problems) {
      const key = groupBy === "topic" ? p.topic.slug : p.pattern.slug;
      const cur = map.get(key) ?? { total: 0, solved: 0 };
      cur.total++;
      if (p.progress?.status === "SOLVED") cur.solved++;
      map.set(key, cur);
    }
    for (const [key, v] of map) if (v.total > 0 && v.solved === v.total) done.add(key);
    return done;
  });

  const toggle = (slug: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  return (
    <div className="animate-rise space-y-3">
      {groups.map((group) => {
        const solved = group.items.filter((p) => p.progress?.status === "SOLVED").length;
        const isCollapsed = collapsed.has(group.slug);
        const pct = percent(solved, group.items.length);

        return (
          <div
            key={group.slug}
            className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
          >
            <button
              onClick={() => toggle(group.slug)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)]"
              aria-expanded={!isCollapsed}
            >
              <ChevronRight
                className={cn(
                  "size-4 shrink-0 text-[var(--fg-subtle)] transition-transform",
                  !isCollapsed && "rotate-90",
                )}
              />
              <span className="font-medium">{group.name}</span>
              <span className="text-[0.8125rem] text-[var(--fg-subtle)] tabular-nums">
                {solved}/{group.items.length}
              </span>
              <div className="ml-auto flex w-40 items-center gap-2">
                <ProgressBar
                  value={solved}
                  total={group.items.length}
                  tone={pct === 100 ? "easy" : "accent"}
                />
                <span className="w-9 text-right text-xs text-[var(--fg-muted)] tabular-nums">
                  {pct}%
                </span>
              </div>
            </button>

            {!isCollapsed && (
              <ul className="border-t border-[var(--border)]">
                {group.items.map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      "flex items-center gap-3 border-b border-[var(--border)] px-4 py-2 last:border-0",
                      "transition-colors hover:bg-[var(--surface-2)]",
                    )}
                  >
                    <StatusCycler
                      problemId={p.id}
                      status={p.progress?.status ?? "TODO"}
                      onChange={async (next) => {
                        await setStatus({ problemId: p.id, status: next });
                      }}
                    />
                    <span className="w-11 shrink-0 font-mono text-xs text-[var(--fg-subtle)] tabular-nums">
                      {p.leetcodeId}
                    </span>
                    <Link
                      href={`/problems/${p.slug}`}
                      className={cn(
                        "flex-1 truncate text-sm font-medium hover:text-[var(--accent)]",
                        p.progress?.status === "SOLVED" && "text-[var(--fg-muted)]",
                      )}
                    >
                      {p.title}
                    </Link>
                    {p.isPremium && <Lock className="size-3 shrink-0 text-[var(--medium)]" />}
                    <span className="hidden shrink-0 text-xs text-[var(--fg-subtle)] sm:block">
                      {groupBy === "topic" ? p.pattern.name : p.topic.name}
                    </span>
                    <DifficultyBadge difficulty={p.difficulty} />
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-md p-1 text-[var(--fg-subtle)] hover:text-[var(--accent)]"
                      aria-label={`Open ${p.title} on LeetCode`}
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
