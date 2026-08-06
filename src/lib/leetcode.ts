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
 */

const GRAPHQL = "https://leetcode.com/graphql";
const TIMEOUT_MS = 12_000;

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
