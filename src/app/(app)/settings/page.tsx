import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/settings/settings-form";
import { LeetCodePanel } from "@/components/settings/leetcode-panel";
import { DangerZone } from "@/components/settings/danger-zone";
import { Card, CardHeader } from "@/components/ui/primitives";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const [user, sync, counts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        handle: true,
        leetcodeUsername: true,
        isPublic: true,
        dailyGoal: true,
      },
    }),
    prisma.leetcodeSync.findUnique({ where: { userId: session.user.id } }),
    Promise.all([
      prisma.progress.count({ where: { userId: session.user.id } }),
      prisma.note.count({ where: { userId: session.user.id } }),
      prisma.attempt.count({ where: { userId: session.user.id } }),
    ]),
  ]);

  if (!user) redirect("/signin");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Signed in as <span className="font-medium text-[var(--fg)]">{user.email}</span>
        </p>
      </div>

      <SettingsForm
        initial={{
          name: user.name ?? "",
          handle: user.handle ?? "",
          isPublic: user.isPublic,
          dailyGoal: user.dailyGoal,
        }}
      />

      <LeetCodePanel
        username={user.leetcodeUsername ?? ""}
        sync={
          sync && {
            username: sync.username,
            totalSolved: sync.totalSolved,
            easySolved: sync.easySolved,
            mediumSolved: sync.mediumSolved,
            hardSolved: sync.hardSolved,
            ranking: sync.ranking,
            contestRating: sync.contestRating,
            lastSyncedAt: sync.lastSyncedAt.toISOString(),
            lastError: sync.lastError,
          }
        }
      />

      <Card>
        <CardHeader title="Your data" subtitle="Everything is exportable, nothing is locked in" />
        <div className="grid grid-cols-3 gap-4 px-5 pb-5 text-center">
          {[
            ["Tracked problems", counts[0]],
            ["Notes", counts[1]],
            ["Logged attempts", counts[2]],
          ].map(([label, value]) => (
            <div key={label as string}>
              <p className="text-xl font-semibold tabular-nums">{value as number}</p>
              <p className="text-[0.6875rem] text-[var(--fg-subtle)]">{label as string}</p>
            </div>
          ))}
        </div>
      </Card>

      <DangerZone />
    </div>
  );
}
