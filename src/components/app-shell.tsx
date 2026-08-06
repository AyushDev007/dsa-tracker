"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import {
  Binary,
  LayoutDashboard,
  ListChecks,
  RotateCcw,
  Layers,
  NotebookPen,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/primitives";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/problems", label: "Problems", icon: ListChecks },
  { href: "/revision", label: "Revision", icon: RotateCcw, badge: "due" as const },
  { href: "/sheets", label: "Sheets", icon: Layers },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

type ShellUser = {
  name: string;
  email: string;
  image: string | null;
  handle: string | null;
};

export function AppShell({
  user,
  dueCount,
  children,
}: {
  user: ShellUser;
  dueCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {NAV.map(({ href, label, icon: Icon, badge }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {badge === "due" && dueCount > 0 && (
              <span className="rounded-full bg-[var(--medium)] px-1.5 py-0.5 text-[0.625rem] font-semibold text-white tabular-nums">
                {dueCount > 99 ? "99+" : dueCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const sidebarBody = (
    <>
      <div className="flex h-14 items-center gap-2 px-5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-fg)]">
          <Binary className="size-4" />
        </div>
        <span className="font-semibold tracking-tight">DSA Tracker</span>
      </div>

      <div className="mt-2">{nav}</div>

      <div className="mt-auto border-t border-[var(--border)] p-3">
        {user.handle && (
          <Link
            href={`/u/${user.handle}`}
            className="mb-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg-muted)]"
          >
            <ExternalLink className="size-3" />
            View public profile
          </Link>
        )}
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          {user.image ? (
            <Image
              src={user.image}
              alt=""
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-full"
            />
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-semibold">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8125rem] font-medium">{user.name}</p>
            <p className="truncate text-[0.6875rem] text-[var(--fg-subtle)]">{user.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[var(--border)] bg-[var(--bg-subtle)] lg:flex">
        {sidebarBody}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--bg-subtle)] lg:hidden">
            <button
              className="absolute top-3.5 right-3 rounded-md p-1 text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
            {sidebarBody}
          </aside>
        </>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg)]/85 px-4 backdrop-blur-md lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </Button>
          <span className="font-semibold tracking-tight lg:hidden">DSA Tracker</span>
          <div className="flex-1" />
          <ThemeToggle />
        </header>

        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
