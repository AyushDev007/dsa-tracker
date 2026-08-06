import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, ProgressBar, Badge } from "@/components/ui/primitives";
import { percent } from "@/lib/utils";
import { ArrowRight, Layers } from "lucide-react";

export const metadata = { title: "Sheets" };
export const dynamic = "force-dynamic";

export default async function SheetsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const sheets = await prisma.sheet.findMany({
    orderBy: { position: "asc" },
    include: {
      problems: {
        select: {
          problem: {
            select: {
              id: true,
              difficulty: true,
              progress: { where: { userId }, select: { status: true } },
            },
          },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sheets</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--fg-muted)]">
          The well-known curated lists, layered over the same problem set — solving a problem once
          ticks it off in every sheet it belongs to.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sheets.map((sheet) => {
          const items = sheet.problems.map((sp) => sp.problem);
          const solved = items.filter((p) => p.progress[0]?.status === "SOLVED").length;
          const pct = percent(solved, items.length);

          const byDifficulty = (["EASY", "MEDIUM", "HARD"] as const).map((d) => {
            const all = items.filter((p) => p.difficulty === d);
            return {
              difficulty: d,
              total: all.length,
              solved: all.filter((p) => p.progress[0]?.status === "SOLVED").length,
            };
          });

          return (
            <Link key={sheet.slug} href={`/sheets/${sheet.slug}`} className="group">
              <Card className="h-full p-5 transition-all group-hover:border-[var(--border-strong)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Layers className="size-4.5" />
                  </div>
                  <ArrowRight className="size-4 text-[var(--fg-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                </div>

                <h2 className="mt-3.5 font-semibold">{sheet.name}</h2>
                <p className="mt-1 min-h-[2.5rem] text-[0.8125rem] leading-relaxed text-[var(--fg-muted)]">
                  {sheet.description}
                </p>

                <div className="mt-4 flex items-baseline justify-between">
                  <span className="text-sm font-semibold tabular-nums">
                    {solved}
                    <span className="font-normal text-[var(--fg-muted)]">/{items.length}</span>
                  </span>
                  <span className="text-xs text-[var(--fg-muted)] tabular-nums">{pct}%</span>
                </div>
                <ProgressBar
                  className="mt-1.5"
                  value={solved}
                  total={items.length}
                  tone={pct === 100 ? "easy" : "accent"}
                />

                <div className="mt-3 flex gap-1.5">
                  {byDifficulty.map((d) => (
                    <Badge
                      key={d.difficulty}
                      tone={d.difficulty.toLowerCase() as "easy" | "medium" | "hard"}
                    >
                      {d.solved}/{d.total} {d.difficulty.charAt(0) + d.difficulty.slice(1).toLowerCase()}
                    </Badge>
                  ))}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
