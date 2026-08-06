"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { PAGE_SIZE } from "@/lib/constants";

export function Pagination({
  page,
  pageCount,
  total,
}: {
  page: number;
  pageCount: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (pageCount <= 1) {
    return (
      <p className="text-center text-xs text-[var(--fg-subtle)]">
        {total} problem{total === 1 ? "" : "s"}
      </p>
    );
  }

  const goto = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p === 1) next.delete("page");
    else next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`, { scroll: true });
  };

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  // Windowed page numbers: 1 … 4 5 [6] 7 8 … 12
  const pages: (number | "gap")[] = [];
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-[var(--fg-muted)] tabular-nums">
        Showing {from}–{to} of {total}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          disabled={page <= 1}
          onClick={() => goto(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>

        {pages.map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-xs text-[var(--fg-subtle)]">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "primary" : "ghost"}
              size="sm"
              className="min-w-8 justify-center tabular-nums"
              onClick={() => goto(p)}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </Button>
          ),
        )}

        <Button
          variant="ghost"
          size="icon"
          disabled={page >= pageCount}
          onClick={() => goto(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
