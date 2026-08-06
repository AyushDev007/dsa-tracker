/**
 * Quick database inspection during development:  npx tsx scripts/inspect-db.ts
 * Prints per-user progress, the activity ledger, and catalogue counts.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, handle: true } });
  console.log(`users: ${users.map((u) => `${u.email} (@${u.handle})`).join(", ") || "none"}`);

  const progress = await prisma.progress.findMany({
    include: { problem: { select: { title: true } } },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  console.log(`\nprogress rows: ${progress.length}`);
  for (const r of progress) {
    console.log(
      `  ${r.problem.title.padEnd(34)} ${r.status.padEnd(10)} conf=${r.confidence ?? "-"} stage=${r.reviewStage} next=${r.nextReviewAt?.toISOString().slice(0, 10) ?? "-"} attempts=${r.attemptCount} time=${r.timeSpentSec}s`,
    );
  }

  const activity = await prisma.activityDay.findMany({ orderBy: { day: "desc" }, take: 10 });
  console.log(`\nactivity days: ${activity.length}`);
  for (const a of activity) {
    console.log(
      `  ${a.day.toISOString().slice(0, 10)}  solved=${a.solved} revised=${a.revised} minutes=${a.minutes}`,
    );
  }

  console.log(`\nattempts: ${await prisma.attempt.count()}`);
  console.log(`notes:    ${await prisma.note.count()}`);
  console.log(`problems: ${await prisma.problem.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
