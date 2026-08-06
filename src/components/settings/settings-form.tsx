"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, Save, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, Button, Input, Label } from "@/components/ui/primitives";
import { updateSettings } from "@/lib/actions";
import { cn } from "@/lib/utils";

export function SettingsForm({
  initial,
}: {
  initial: { name: string; handle: string; isPublic: boolean; dailyGoal: number };
}) {
  const { update } = useSession();
  const [name, setName] = useState(initial.name);
  const [handle, setHandle] = useState(initial.handle);
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [dailyGoal, setDailyGoal] = useState(initial.dailyGoal);
  const [isPending, startTransition] = useTransition();

  const dirty =
    name !== initial.name ||
    handle !== initial.handle ||
    isPublic !== initial.isPublic ||
    dailyGoal !== initial.dailyGoal;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await updateSettings({
          name: name.trim() || undefined,
          handle: handle.trim() || undefined,
          isPublic,
          dailyGoal,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        // Push the new handle/name into the JWT so the sidebar updates too.
        await update();
        toast.success("Settings saved");
      } catch (err) {
        toast.error(
          err instanceof Error && err.message.includes("hyphen")
            ? "Handles can only use lowercase letters, numbers and hyphens."
            : "Couldn't save your settings",
        );
      }
    });
  };

  return (
    <Card>
      <form onSubmit={submit}>
        <CardHeader title="Profile" subtitle="How you appear in the app and on your public page" />

        <div className="space-y-4 px-5 pb-5">
          <div>
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              className="mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Your name"
            />
          </div>

          <div>
            <Label htmlFor="handle">Public handle</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="shrink-0 text-sm text-[var(--fg-subtle)]">/u/</span>
              <Input
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                maxLength={24}
                placeholder="your-handle"
              />
              {initial.handle && (
                <Link href={`/u/${initial.handle}`} target="_blank">
                  <Button variant="ghost" size="icon" type="button" aria-label="Open public profile">
                    <ExternalLink className="size-4" />
                  </Button>
                </Link>
              )}
            </div>
            <p className="mt-1.5 text-xs text-[var(--fg-subtle)]">
              3–24 characters, lowercase letters, numbers and hyphens.
            </p>
          </div>

          <div>
            <Label htmlFor="goal">Daily goal</Label>
            <div className="mt-1.5 flex items-center gap-3">
              <input
                id="goal"
                type="range"
                min={1}
                max={15}
                value={dailyGoal}
                onChange={(e) => setDailyGoal(Number(e.target.value))}
                className="flex-1 accent-[var(--accent)]"
              />
              <span className="w-24 text-sm tabular-nums">
                <span className="font-semibold">{dailyGoal}</span>
                <span className="text-[var(--fg-muted)]"> / day</span>
              </span>
            </div>
          </div>

          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              isPublic
                ? "border-[var(--accent)] bg-[var(--accent-soft)]/40"
                : "border-[var(--border)] hover:border-[var(--border-strong)]",
            )}
          >
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-[0.8125rem] font-medium">Make my profile public</span>
              <span className="block text-xs text-[var(--fg-muted)]">
                Anyone with the link sees your heatmap, streaks and solve counts. Your notes, code
                and timings stay private either way.
              </span>
            </span>
          </label>
        </div>

        <div className="flex justify-end border-t border-[var(--border)] px-5 py-3">
          <Button type="submit" variant="primary" size="sm" disabled={!dirty || isPending}>
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}
