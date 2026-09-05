import "server-only";

/**
 * LeetCode integration — public data only.
 *
 * LeetCode has no official public API. This uses the same unauthenticated
 * GraphQL endpoint the profile page itself calls, which means:
 *
 *   • It needs nothing but a username — no cookies, no tokens, no credentials
 *     stored anywhere, and no way for this to compromise the user's account.
 *   • It can see solve counts, the submission calendar, contest rating, and the
 *     user's *recent* accepted submissions (LeetCode caps that feed at ~20).
 *   • It cannot see full submitted source code or the complete solved list —
 *     those are behind the session cookie, which we deliberately do not touch.
 *
 * Because it's unofficial it can change without notice, so every call is
 * defensive: failures degrade to "sync unavailable" rather than breaking a page.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Authenticated mode (opt-in)
 *
 * The 20-item cap above is a hard server-side limit, verified against live
 * profiles: asking for limit 100 or 500 still returns exactly 20. So the public
 * endpoint can keep up with new solves but can *never* backfill a history.
 *
 * `fetchSolvedSlugs` therefore takes the user's own LEETCODE_SESSION cookie and
 * pages the problem list with `filters: { status: "AC" }`, which returns every
 * problem LeetCode records as solved. Without the cookie that same field comes
 * back null for everyone.
 *
 * The cookie is a live credential. It is supplied by the user, encrypted at
 * rest, sent only to leetcode.com over HTTPS, and never logged.
 */

const GRAPHQL = "https://leetcode.com/graphql";
const TIMEOUT_MS = 12_000;
/** LeetCode caps the problem-list page size at 100 whatever we ask for. */
const PAGE_SIZE = 100;
/** Stop a runaway pagination loop if LeetCode's `total` disagrees with reality. */
const MAX_PAGES = 60;

export type LeetCodeProfile = {
  username: string;
  realName: string | null;
  avatar: string | null;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  ranking: number | null;
  contestRating: number | null;
  /** { "2026-08-05": 4, ... } — submissions per day, keyed by UTC date. */
  calendar: Record<string, number>;
  /** Slugs from the recent-AC feed. Capped by LeetCode at ~20 entries. */
  recentAcceptedSlugs: string[];
};

export type LeetCodeResult =
  | { ok: true; profile: LeetCodeProfile }
  | { ok: false; error: string };

const PROFILE_QUERY = `
  query userProfile($username: String!) {
    matchedUser(username: $username) {
      username
      profile { realName userAvatar ranking }
      submitStats { acSubmissionNum { difficulty count } }
      userCalendar { submissionCalendar }
    }
    userContestRanking(username: $username) { rating }
    recentAcSubmissionList(username: $username, limit: 20) { titleSlug }
  }
`;

type GraphQLResponse = {
  data?: {
    matchedUser: {
      username: string;
      profile: { realName: string | null; userAvatar: string | null; ranking: number | null };
      submitStats: { acSubmissionNum: { difficulty: string; count: number }[] };
      userCalendar: { submissionCalendar: string | null } | null;
    } | null;
    userContestRanking: { rating: number | null } | null;
    recentAcSubmissionList: { titleSlug: string }[] | null;
  };
  errors?: { message: string }[];
};

/**
 * LeetCode returns the calendar as a JSON string of `unixSeconds -> count`.
 * Re-key it to ISO dates so the heatmap can merge it with our own activity.
 */
function parseCalendar(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    const out: Record<string, number> = {};
    for (const [seconds, count] of Object.entries(parsed)) {
      const date = new Date(Number(seconds) * 1000);
      if (Number.isNaN(date.getTime())) continue;
      const key = date.toISOString().slice(0, 10);
      out[key] = (out[key] ?? 0) + count;
    }
    return out;
  } catch {
    return {};
  }
}

export async function fetchLeetCodeProfile(username: string): Promise<LeetCodeResult> {
  const clean = username.trim().replace(/^@/, "");
  if (!clean || !/^[A-Za-z0-9_.-]{1,64}$/.test(clean)) {
    return { ok: false, error: "That doesn't look like a valid LeetCode username." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(GRAPHQL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        referer: `https://leetcode.com/u/${clean}/`,
        "user-agent": "Mozilla/5.0 (compatible; dsa-tracker/1.0)",
      },
      body: JSON.stringify({ query: PROFILE_QUERY, variables: { username: clean } }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 429
            ? "LeetCode is rate-limiting us. Try again in a minute."
            : `LeetCode responded with ${res.status}.`,
      };
    }

    const json = (await res.json()) as GraphQLResponse;

    if (json.errors?.length) {
      const msg = json.errors[0].message ?? "";
      return {
        ok: false,
        error: /no.*user|not found/i.test(msg)
          ? `No LeetCode user called "${clean}".`
          : "LeetCode rejected the request.",
      };
    }

    const user = json.data?.matchedUser;
    if (!user) return { ok: false, error: `No LeetCode user called "${clean}".` };

    const byDifficulty = Object.fromEntries(
      user.submitStats.acSubmissionNum.map((s) => [s.difficulty, s.count]),
    ) as Record<string, number>;

    return {
      ok: true,
      profile: {
        username: user.username,
        realName: user.profile?.realName ?? null,
        avatar: user.profile?.userAvatar ?? null,
        totalSolved: byDifficulty.All ?? 0,
        easySolved: byDifficulty.Easy ?? 0,
        mediumSolved: byDifficulty.Medium ?? 0,
        hardSolved: byDifficulty.Hard ?? 0,
        ranking: user.profile?.ranking ?? null,
        contestRating: json.data?.userContestRanking?.rating
          ? Math.round(json.data.userContestRanking.rating)
          : null,
        calendar: parseCalendar(user.userCalendar?.submissionCalendar),
        recentAcceptedSlugs: [
          ...new Set((json.data?.recentAcSubmissionList ?? []).map((s) => s.titleSlug)),
        ],
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "LeetCode took too long to respond." };
    }
    return { ok: false, error: "Couldn't reach LeetCode. Check your connection and retry." };
  } finally {
    clearTimeout(timer);
  }
}

/* ──────────────────────────────────────────────── authenticated full sync ── */

export type LeetCodeCredentials = {
  /** Value of the LEETCODE_SESSION cookie. */
  session: string;
  /** Value of the csrftoken cookie. LeetCode wants it echoed in a header too. */
  csrf?: string | null;
};

export type SolvedSlugsResult =
  | {
      ok: true;
      /** Every problem slug LeetCode reports as accepted for this account. */
      slugs: string[];
      /**
       * Slug → epoch milliseconds of the most recent accepted submission, where
       * LeetCode exposed one. Used to date backfilled solves instead of stamping
       * a whole history onto today.
       */
      solvedAt: Record<string, number>;
    }
  | { ok: false; error: string; expired?: boolean };

const SOLVED_QUERY = `
  query solvedQuestions($cat: String!, $skip: Int!, $limit: Int!, $filters: QuestionListFilterInput) {
    problemsetQuestionList: questionList(categorySlug: $cat, limit: $limit, skip: $skip, filters: $filters) {
      total: totalNum
      questions: data {
        titleSlug
        status
      }
    }
  }
`;

const PROGRESS_QUERY = `
  query userProgress($skip: Int!, $limit: Int!) {
    userProgressQuestionList(filters: { skip: $skip, limit: $limit, questionStatus: SOLVED }) {
      totalNum
      questions { titleSlug lastSubmittedAt }
    }
  }
`;

function cookieHeader(creds: LeetCodeCredentials): string {
  const parts = [`LEETCODE_SESSION=${creds.session}`];
  if (creds.csrf) parts.push(`csrftoken=${creds.csrf}`);
  return parts.join("; ");
}

async function authedGraphQL(
  creds: LeetCodeCredentials,
  query: string,
  variables: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; expired?: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GRAPHQL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(creds),
        ...(creds.csrf ? { "x-csrftoken": creds.csrf } : {}),
        referer: "https://leetcode.com/problemset/",
        "user-agent": "Mozilla/5.0 (compatible; dsa-tracker/1.0)",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      cache: "no-store",
    });

    // 401/403 is what an expired or revoked cookie looks like. Say so precisely,
    // because "sign in again" and "LeetCode is down" need different reactions.
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Your LeetCode session cookie has expired.", expired: true };
    }
    if (res.status === 429) {
      return { ok: false, error: "LeetCode is rate-limiting us. Try again in a minute." };
    }
    if (!res.ok) return { ok: false, error: `LeetCode responded with ${res.status}.` };

    const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
    if (json.errors?.length) {
      const msg = json.errors[0].message ?? "";
      if (/authenticat|permission|login/i.test(msg)) {
        return { ok: false, error: "Your LeetCode session cookie has expired.", expired: true };
      }
      return { ok: false, error: "LeetCode rejected the request." };
    }
    if (!json.data) return { ok: false, error: "LeetCode returned no data." };
    return { ok: true, data: json.data };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "LeetCode took too long to respond." };
    }
    return { ok: false, error: "Couldn't reach LeetCode. Check your connection and retry." };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Best-effort solve timestamps. LeetCode's progress endpoint carries
 * `lastSubmittedAt`, which lets a backfill date each solve rather than dumping
 * a year of history onto today's heatmap. It is a newer endpoint than the
 * problem list and may vanish, so a failure here is not a failure of the sync —
 * the caller simply gets fewer dates.
 */
async function fetchSolveDates(creds: LeetCodeCredentials): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await authedGraphQL(creds, PROGRESS_QUERY, {
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    });
    if (!res.ok) break;

    const list = (
      res.data as {
        userProgressQuestionList?: {
          totalNum: number;
          questions: { titleSlug: string; lastSubmittedAt: string | null }[];
        };
      }
    ).userProgressQuestionList;
    if (!list?.questions?.length) break;

    for (const q of list.questions) {
      if (!q.lastSubmittedAt) continue;
      const t = Date.parse(q.lastSubmittedAt);
      if (!Number.isNaN(t)) out[q.titleSlug] = t;
    }

    if ((page + 1) * PAGE_SIZE >= list.totalNum) break;
  }
  return out;
}

/**
 * Every problem this account has solved, using the user's own session cookie.
 *
 * This is the only way to backfill a solve history: the unauthenticated feed is
 * capped at 20 recent submissions no matter what limit is requested.
 */
export async function fetchSolvedSlugs(creds: LeetCodeCredentials): Promise<SolvedSlugsResult> {
  const slugs: string[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await authedGraphQL(creds, SOLVED_QUERY, {
      cat: "",
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
      filters: { status: "AC" },
    });
    if (!res.ok) return res;

    const list = (
      res.data as {
        problemsetQuestionList?: {
          total: number;
          questions: { titleSlug: string; status: string | null }[];
        };
      }
    ).problemsetQuestionList;

    if (!list) return { ok: false, error: "LeetCode returned an unexpected problem list." };

    // `status` still comes back null when the cookie isn't actually authenticating.
    // Without this check an unauthenticated response looks like "you've solved
    // every problem", which would tick the entire catalogue.
    for (const q of list.questions) {
      if (q.status !== "ac") continue;
      slugs.push(q.titleSlug);
    }

    if (page === 0 && list.total > 0 && slugs.length === 0) {
      return {
        ok: false,
        error:
          "LeetCode accepted the request but reported no solved problems — the session cookie is not authenticating.",
        expired: true,
      };
    }

    if (list.questions.length === 0 || (page + 1) * PAGE_SIZE >= list.total) break;
  }

  return { ok: true, slugs: [...new Set(slugs)], solvedAt: await fetchSolveDates(creds) };
}
