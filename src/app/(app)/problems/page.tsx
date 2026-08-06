import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getProblems, getFilterOptions, type ProblemFilters } from "@/lib/queries";
import { ProblemFiltersBar } from "@/components/problems/filters-bar";
import { ProblemTable } from "@/components/problems/problem-table";
import { Pagination } from "@/components/problems/pagination";
import { GroupedProblems } from "@/components/problems/grouped-problems";

export const metadata = { title: "Problems" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function ProblemsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const sp = await searchParams;
  const filters: ProblemFilters = {
    q: one(sp.q),
    topic: one(sp.topic),
    pattern: one(sp.pattern),
    difficulty: one(sp.difficulty),
    status: one(sp.status),
    company: one(sp.company),
    sheet: one(sp.sheet),
    bookmarked: one(sp.bookmarked) === "1",
    sort: one(sp.sort),
    page: Number(one(sp.page) ?? 1),
  };
  const groupBy = one(sp.group); // "topic" | "pattern" | undefined

  const [{ problems, total, page, pageCount }, options] = await Promise.all([
    // Grouped views need every match so each group is complete; the flat list
    // is paginated.
    getProblems(session.user.id, { ...filters, all: Boolean(groupBy) }),
    getFilterOptions(),
  ]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Problems</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {total} curated problem{total === 1 ? "" : "s"}
          {groupBy ? ` grouped by ${groupBy}` : ""} — filter by topic, by pattern, or by the
          company that asks them.
        </p>
      </div>

      <ProblemFiltersBar options={options} total={total} />

      {groupBy ? (
        <GroupedProblems problems={problems} groupBy={groupBy as "topic" | "pattern"} />
      ) : (
        <>
          <ProblemTable problems={problems} />
          <Pagination page={page} pageCount={pageCount} total={total} />
        </>
      )}
    </div>
  );
}
