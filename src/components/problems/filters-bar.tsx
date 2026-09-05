"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Search,
  X,
  SlidersHorizontal,
  Star,
  LayoutGrid,
  List,
  ListChecks,
  Library,
  Loader2,
} from "lucide-react";
import { Button, Input, Select, Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Option = { name: string; slug: string; _count: { problems: number } };

export function ProblemFiltersBar({
  options,
  total,
  scope,
}: {
  options: {
    topics: Option[];
    patterns: (Option & { description: string | null })[];
    companies: Option[];
    sheets: { name: string; slug: string; description: string | null }[];
  };
  total: number;
  /** Which half of the catalogue is being shown — see ProblemFilters.scope. */
  scope: "curated" | "all";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [search, setSearch] = useState(params.get("q") ?? "");

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      // Any filter change invalidates the current page number.
      if (!("page" in updates)) next.delete("page");
      startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  // Debounce the search box so typing doesn't fire a query per keystroke.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;
    const t = setTimeout(() => setParam({ q: search || null }), 350);
    return () => clearTimeout(t);
  }, [search, params, setParam]);

  const get = (k: string) => params.get(k) ?? "";
  const group = get("group");
  const bookmarked = get("bookmarked") === "1";

  const activeFilters = [
    get("topic") && {
      key: "topic",
      label: options.topics.find((t) => t.slug === get("topic"))?.name ?? get("topic"),
    },
    get("pattern") && {
      key: "pattern",
      label: options.patterns.find((p) => p.slug === get("pattern"))?.name ?? get("pattern"),
    },
    get("difficulty") && { key: "difficulty", label: titleCase(get("difficulty")) },
    get("status") && { key: "status", label: titleCase(get("status")) },
    get("company") && {
      key: "company",
      label: options.companies.find((c) => c.slug === get("company"))?.name ?? get("company"),
    },
    get("sheet") && {
      key: "sheet",
      label: options.sheets.find((s) => s.slug === get("sheet"))?.name ?? get("sheet"),
    },
    bookmarked && { key: "bookmarked", label: "Bookmarked" },
  ].filter(Boolean) as { key: string; label: string }[];

  const clearAll = () => {
    setSearch("");
    startTransition(() => router.push(pathname, { scroll: false }));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[210px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--fg-subtle)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or LeetCode number…"
            className="pl-9"
            aria-label="Search problems"
          />
          {isPending && (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-[var(--fg-subtle)]" />
          )}
        </div>

        <Select
          value={get("topic")}
          onChange={(e) => setParam({ topic: e.target.value || null })}
          aria-label="Filter by topic"
          className="w-auto min-w-[10.5rem]"
        >
          <option value="">All topics</option>
          {options.topics.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name} ({t._count.problems})
            </option>
          ))}
        </Select>

        <Select
          value={get("pattern")}
          onChange={(e) => setParam({ pattern: e.target.value || null })}
          aria-label="Filter by pattern"
          className="w-auto min-w-[11rem]"
        >
          <option value="">All patterns</option>
          {options.patterns.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name} ({p._count.problems})
            </option>
          ))}
        </Select>

        <Select
          value={get("difficulty")}
          onChange={(e) => setParam({ difficulty: e.target.value || null })}
          aria-label="Filter by difficulty"
          className="w-auto min-w-[8rem]"
        >
          <option value="">Any difficulty</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </Select>

        <Select
          value={get("status")}
          onChange={(e) => setParam({ status: e.target.value || null })}
          aria-label="Filter by status"
          className="w-auto min-w-[8.5rem]"
        >
          <option value="">Any status</option>
          <option value="TODO">To do</option>
          <option value="ATTEMPTED">Attempted</option>
          <option value="SOLVED">Solved</option>
        </Select>

        <Button
          variant={showAdvanced ? "primary" : "secondary"}
          size="md"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <SlidersHorizontal className="size-4" />
          More
        </Button>
      </div>

      {showAdvanced && (
        <div className="animate-rise flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <Select
            value={get("company")}
            onChange={(e) => setParam({ company: e.target.value || null })}
            aria-label="Filter by company"
            className="w-auto min-w-[10rem]"
          >
            <option value="">Any company</option>
            {options.companies.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name} ({c._count.problems})
              </option>
            ))}
          </Select>

          <Select
            value={get("sheet")}
            onChange={(e) => setParam({ sheet: e.target.value || null })}
            aria-label="Filter by sheet"
            className="w-auto min-w-[10rem]"
          >
            <option value="">Any sheet</option>
            {options.sheets.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </Select>

          <Select
            value={get("sort")}
            onChange={(e) => setParam({ sort: e.target.value || null })}
            aria-label="Sort"
            className="w-auto min-w-[10rem]"
          >
            <option value="">Sort: study order</option>
            <option value="number">Sort: LeetCode #</option>
            <option value="title">Sort: title A–Z</option>
            <option value="difficulty-asc">Sort: easiest first</option>
            <option value="difficulty-desc">Sort: hardest first</option>
            <option value="acceptance">Sort: highest acceptance</option>
          </Select>

          <Button
            variant={bookmarked ? "primary" : "secondary"}
            size="md"
            onClick={() => setParam({ bookmarked: bookmarked ? null : "1" })}
          >
            <Star className={cn("size-4", bookmarked && "fill-current")} />
            Bookmarked
          </Button>

          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
            <GroupButton
              active={scope === "curated"}
              onClick={() => setParam({ scope: null })}
              icon={ListChecks}
            >
              Curated
            </GroupButton>
            <GroupButton
              active={scope === "all"}
              onClick={() => setParam({ scope: "all" })}
              icon={Library}
            >
              All LeetCode
            </GroupButton>
          </div>

          <div className="ml-auto flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
            <GroupButton active={!group} onClick={() => setParam({ group: null })} icon={List}>
              List
            </GroupButton>
            <GroupButton
              active={group === "topic"}
              onClick={() => setParam({ group: "topic" })}
              icon={LayoutGrid}
            >
              By topic
            </GroupButton>
            <GroupButton
              active={group === "pattern"}
              onClick={() => setParam({ group: "pattern" })}
              icon={LayoutGrid}
            >
              By pattern
            </GroupButton>
          </div>
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--fg-subtle)]">{total} matching ·</span>
          {activeFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setParam({ [f.key]: null })}
              className="group"
              aria-label={`Remove ${f.label} filter`}
            >
              <Badge tone="accent" className="gap-1 py-1 pr-1 pl-2">
                {f.label}
                <X className="size-3 opacity-60 group-hover:opacity-100" />
              </Badge>
            </button>
          ))}
          <button
            onClick={clearAll}
            className="ml-1 text-xs text-[var(--fg-subtle)] underline underline-offset-2 hover:text-[var(--fg)]"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function GroupButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors",
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
