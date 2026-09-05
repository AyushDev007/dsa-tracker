import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { LeetCodeAutoSync } from "@/components/leetcode-autosync";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  // The sidebar shows a live count of problems due for revision, so it has to
  // be fetched in the layout rather than in each page.
  const dueCount = await prisma.progress.count({
    where: {
      userId: session.user.id,
      status: "SOLVED",
      nextReviewAt: { lte: new Date() },
    },
  });

  return (
    <AppShell
      user={{
        name: session.user.name ?? "You",
        email: session.user.email ?? "",
        image: session.user.image ?? null,
        handle: session.user.handle,
      }}
      dueCount={dueCount}
    >
      {/* Pulls new LeetCode solves in the background — see the component. */}
      <LeetCodeAutoSync />
      {children}
    </AppShell>
  );
}
