"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/primitives";

export function NotesSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initial);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (value === initial) return;
    const t = setTimeout(() => {
      const url = value.trim() ? `${pathname}?q=${encodeURIComponent(value.trim())}` : pathname;
      startTransition(() => router.push(url, { scroll: false }));
    }, 350);
    return () => clearTimeout(t);
  }, [value, initial, pathname, router]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--fg-subtle)]" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search your notes and solution code…"
        className="pl-9"
        aria-label="Search notes"
      />
      {isPending ? (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-[var(--fg-subtle)]" />
      ) : value ? (
        <button
          onClick={() => setValue("")}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--fg-subtle)] hover:text-[var(--fg)]"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
