"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { syncLeetCodeIfStale } from "@/lib/actions";

/**
 * Keeps the tracker current with LeetCode without anyone pressing a button.
 *
 * Before this existed, `syncLeetCode` was only ever called from the Settings
 * page, so a problem solved on leetcode.com stayed unticked here until the user
 * remembered to go and click "Re-sync" — which is the whole reason syncing
 * appeared not to work.
 *
 * Mounted once in the app shell. On mount, and then on an interval while the
 * tab is open, it asks the server to sync *if the last one is stale*; the
 * staleness check lives on the server so navigating between pages can't turn
 * into a request storm against LeetCode.
 *
 * Deliberately quiet: it announces itself only when it actually ticks something
 * off, and never reports failures. A background refresh that interrupts you to
 * say LeetCode timed out is worse than one that stays silent and retries later.
 */

/** How often to re-check while a tab stays open. The server enforces its own,
 *  longer, minimum interval — this only decides how often we ask. */
const POLL_MS = 5 * 60 * 1000;

export function LeetCodeAutoSync() {
  const router = useRouter();
  // Survives the double-invoked mount of React strict mode in development.
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (running.current || document.visibilityState === "hidden") return;
      running.current = true;
      try {
        const res = await syncLeetCodeIfStale();
        if (cancelled || !res.ok || !res.marked) return;

        toast.success(
          `${res.marked} problem${res.marked === 1 ? "" : "s"} marked solved from LeetCode`,
          { description: "Synced automatically in the background." },
        );
        router.refresh();
      } catch {
        // Silent by design — see the note above.
      } finally {
        running.current = false;
      }
    };

    void run();
    const timer = setInterval(run, POLL_MS);
    // Coming back to a tab left open overnight should refresh promptly.
    document.addEventListener("visibilitychange", run);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [router]);

  return null;
}
