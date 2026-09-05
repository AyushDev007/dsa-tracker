# DSA Tracker

A full-stack interview-prep tracker for the whole free LeetCode catalogue —
3,268 problems — with a hand-curated 311-problem study plan layered on top,
organised **by topic and by pattern**, with spaced-repetition revision, notes, a
solve heatmap, and LeetCode sync.

Built with Next.js 15 (App Router), TypeScript, Tailwind v4, Prisma + PostgreSQL
and Auth.js v5.

---

## Quick start

One-time setup, then a single command to run it.

Requires **Node 20.11 or newer**.

```bash
npm install
```

```bash
npm approve-scripts prisma @prisma/client @prisma/engines esbuild sharp unrs-resolver @embedded-postgres/windows-x64
```

> npm 11 blocks install scripts by default. Prisma's query engine and esbuild
> (which `tsx` uses) need theirs. On macOS/Linux swap the last package for
> `@embedded-postgres/darwin-arm64` or `@embedded-postgres/linux-x64`.

```bash
cp .env.example .env
```

### Create the database

This bundles a real PostgreSQL server, so there is nothing to install — no
Docker, no admin rights, no cloud account. Create the cluster once:

```bash
npm run db:local
```

Leave that running, and in a second terminal load the schema and problems:

```bash
npm run setup
```

Then stop the first terminal with Ctrl+C. You only ever do this once.

> Prefer Docker? `docker compose up -d` works with the same default `.env`.
> Prefer Neon (what you'll use in production)? Create a free project at
> [neon.tech](https://neon.tech) and put the pooled string in `DATABASE_URL`
> and the unpooled one in `DIRECT_URL`.

### Run it

```bash
npm run dev
```

**One command, one terminal.** `dev` starts the database first if it isn't
already up (detached, so it survives closing the terminal), then Next.js. If
`DATABASE_URL` points at a remote database it skips that step entirely.

To shut the database down:

```bash
npm run db:stop
```

Open <http://localhost:3000> and click **Continue as demo user** — a local-only
login that exists so you can use the whole app before setting up any OAuth app.

Want the dashboard and analytics to have something to show?

```bash
npm run db:demo
```

That generates ~110 problems of plausible history (deterministic, so it looks
the same every run). Clear it any time from **Settings → Reset all progress**.

---

## Real sign-in (GitHub / Google)

The demo login is disabled automatically in production. For real accounts, add
OAuth credentials to `.env`:

**GitHub** — <https://github.com/settings/developers> → New OAuth App

| Field | Value |
|---|---|
| Homepage URL | `http://localhost:3000` |
| Authorization callback URL | `http://localhost:3000/api/auth/callback/github` |

**Google** — <https://console.cloud.google.com/apis/credentials> → OAuth client ID → Web application

| Field | Value |
|---|---|
| Authorised JavaScript origin | `http://localhost:3000` |
| Authorised redirect URI | `http://localhost:3000/api/auth/callback/google` |

Then:

```bash
npx auth secret
```

…and paste the result as `AUTH_SECRET`. Restart `npm run dev`; both buttons
appear on `/signin` automatically once their variables are set.

---

## What's in it

| Feature | Where |
|---|---|
| **Browse by topic or pattern** — 27 topics, 61 patterns, filter/search/sort, or group into collapsible accordions with per-group progress. Toggle between the curated 311 and all 3,268 | `/problems` |
| **Company filters** — narrow to what Amazon, Google, Meta… tend to ask | `/problems?company=…` |
| **Spaced repetition** — rate a solve *struggled / ok / confident* and it reschedules on a 1→3→7→21→45→90 day ladder | `/revision` |
| **Notes** — markdown write-up plus a syntax-highlighted solution and complexity per problem, searchable across everything | `/problems/[slug]`, `/notes` |
| **Timer + attempt log** — wall-clock timer that survives a backgrounded tab, hint flag, full attempt history | `/problems/[slug]` |
| **Heatmap + streaks** — a year of activity, merged with your real LeetCode submission calendar | `/dashboard` |
| **Daily goal ring** | `/dashboard` |
| **Analytics** — weak-area detection, coverage by topic and pattern, weekly trend, median solve time, first-try and hint rates | `/analytics` |
| **Curated sheets** — Blind 75, NeetCode 150, Striver SDE Sheet, Grind 75, layered over the same problems | `/sheets` |
| **LeetCode sync** — solve counts, contest rating, submission calendar, and auto-marking of everything you have solved | `/settings` |
| **Public profile** — opt-in read-only page with heatmap and stats | `/u/[handle]` |
| **CSV export + reset** | `/settings` |

### On the LeetCode integration

LeetCode has no official public API, so this talks to the same GraphQL endpoint
the site's own pages call. It runs in one of two modes, and the difference is
worth understanding before you rely on it.

**Username only (the default).** Needs nothing but your handle — no password, no
cookie, nothing stored that could compromise the account. It reads solve counts,
the submission calendar, contest rating, and your accepted submissions. But
LeetCode caps that last feed at your **20 most recent** solves, and the cap is
enforced server-side: asking for 100 or 500 returns exactly 20. Verified against
live profiles.

That cap has a consequence people hit immediately: **this mode can keep up with
new solves, but it can never backfill a history.** If you have 800 problems
solved on LeetCode and you link your username, 20 of them get ticked.

**Session cookie (opt-in, in Settings).** You paste your own `LEETCODE_SESSION`
cookie. The problem list then comes back with each problem's real status, so
everything you have ever solved gets ticked — dated by LeetCode's own submission
timestamps, so a backfill lands on the days you actually solved them instead of
dropping a year of history onto today's heatmap.

That cookie is a live credential: anyone holding it can act as you on
leetcode.com until it expires. So:

- It is encrypted at rest with AES-256-GCM, keyed from `AUTH_SECRET`
  (`src/lib/crypto.ts`), and never returned to the browser — the UI only ever
  learns whether *a* cookie exists.
- It is verified against LeetCode before being stored, so a bad paste fails
  loudly instead of silently doing nothing.
- It is sent only to leetcode.com, over HTTPS, and never logged.
- Only paste it into an instance you control. Signing out of LeetCode
  invalidates it whenever you want it gone; "Forget cookie" drops it here.

Neither mode ever un-marks anything: LeetCode not reporting a problem is not
evidence you did not solve it. Syncing runs **automatically in the background**
while the app is open (throttled server-side to once every 15 minutes), so new
solves appear without anyone pressing a button. Because the endpoint is
unofficial it can change without notice; every call is defensive and a failure
degrades to "sync unavailable" rather than breaking a page.

### On the problem data

The catalogue is every **free** problem on LeetCode — 3,268 of the 4,042 total.
The 774 premium-only problems are left out, because tracking a problem you
cannot open is noise. The eight exceptions are curated problems that have since
gone premium (`alien-dictionary`, `meeting-rooms`, …); they stay, flagged, so
Blind 75 and NeetCode 150 do not quietly develop holes.

Taxonomy comes from two places, and the app distinguishes them:

- **Curated (311 problems).** `data/curated.ts` is hand-maintained — topic,
  pattern, sheet membership, company tags, study order. This is the default view
  on `/problems`, because a study plan is not "solve everything".
- **Derived (the rest).** `data/taxonomy.ts` maps LeetCode's own `topicTags`
  onto the same 27 topics and 61 patterns through an ordered rule table, most
  specific rule first — so a problem tagged both `array` and `union-find` is
  filed under Union Find, not arrays. Deterministic and auditable: the build
  prints every rule that fired and how often, so a bad rule shows up as an
  implausible bucket rather than silently mislabelling 400 problems.

A derived pattern is a reasonable guess, not a considered one, and the UI says
so rather than presenting both as equally authoritative.

Titles, question numbers, difficulty, acceptance rate and premium flags all come
from LeetCode's public list via the build script:

```bash
npm run problems:build
```

The generated JSON is committed, so seeding and deploys never need network
access. Re-run it after editing the curated list, or periodically to pick up
newly published problems; it fails loudly if a curated slug no longer exists.

Company tags are indicative — LeetCode's real company data is paywalled and
crowd-sourced. Treat them as "commonly reported", not gospel.

---

## Deploying to Vercel + Neon

**1. Create the database.** At [neon.tech](https://neon.tech), create a free
project. From the dashboard copy two connection strings:

- the **pooled** one (has `-pooler` in the host) → `DATABASE_URL`
- the **direct/unpooled** one → `DIRECT_URL`

**2. Push the repo.**

```bash
git init && git add -A && git commit -m "DSA tracker"
gh repo create dsa-tracker --private --source=. --push
```

**3. Import it on Vercel** at [vercel.com/new](https://vercel.com/new) and set
these environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `AUTH_SECRET` | output of `npx auth secret` |
| `AUTH_URL` | `https://your-app.vercel.app` |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | from your GitHub OAuth app |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | from your Google OAuth client |

Do **not** set `ENABLE_DEV_LOGIN` — the demo provider refuses to load in
production regardless, but leaving it out keeps the intent clear.

**4. Update the OAuth callback URLs** to your deployed origin:

- GitHub → `https://your-app.vercel.app/api/auth/callback/github`
- Google → `https://your-app.vercel.app/api/auth/callback/google`

**5. Deploy.** The build command is
`prisma generate && prisma migrate deploy && tsx prisma/seed.ts && next build`,
so the schema is migrated and the whole catalogue is seeded automatically on
every deploy. The seed is idempotent and batched — a re-seed with no upstream
changes is a single SELECT, and it never touches user data.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (no database needed) |
| `npm run db:local` | Run the bundled Postgres in the foreground (first-time setup) |
| `npm run db:stop` | Stop the detached Postgres |
| `npm run setup` | Generate client + push schema + seed problems |
| `npm run db:seed` | Re-seed the problem catalogue (idempotent) |
| `npm run db:demo` | Generate demo progress for the first user |
| `npm run db:studio` | Prisma Studio |
| `npm run db:migrate` | Create a migration after a schema change |
| `npm run problems:build` | Rebuild `data/problems.json` from LeetCode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

---

## If it stops working

**Page shows a 500, or "Can't reach database server".** The database isn't
running. `npm run dev` starts it automatically, so this only happens if the
app is already running and the database went down separately:

```bash
npm run db:start
```

**"No database cluster in .postgres/".** You haven't done the one-time setup.
Run `npm run db:local` in one terminal and `npm run setup` in another.

**Port 5432 already in use by something else.** Another Postgres is running.
Either use it (update `DATABASE_URL`) or point this one elsewhere with
`LOCAL_DB_PORT=5433` plus a matching `DATABASE_URL`.

**Everything looks broken after a crash or a reboot.** Nothing is lost — the
data lives in `.postgres/`. Just `npm run dev`.

The database log is at `.postgres.log` in the project root.

---

## Architecture notes

- **Server Components by default.** Data is fetched in the page; only the
  interactive bits (`filters-bar`, `problem-workspace`, charts) are client
  components. Mutations are Server Actions in `src/lib/actions.ts`, all of which
  re-derive the user from the session rather than trusting a client-supplied id.
- **Filters live in the URL**, so any view is linkable and the back button works.
- **Optimistic updates** on the status control (`useOptimistic`) so ticking off a
  run of problems never feels laggy.
- **The heatmap reads one pre-aggregated table** (`ActivityDay`), so it stays a
  single indexed range scan no matter how much history accumulates.
- **Auth is JWT-session** because the local dev provider can't use database
  sessions; the profile fields are denormalised into the token and refreshed on
  login and on `useSession().update()`.
- **Middleware only checks that a session cookie exists** — cheap enough to run
  on the edge without pulling Prisma in. Every protected page still calls
  `auth()` server-side and does the real verification.
- **Chart colours are validated, not eyeballed.** The two-series trend uses a
  blue/orange pair that clears colour-vision-deficiency separation in both light
  and dark mode. Difficulty is deliberately *not* a colour-coded categorical
  series — green/amber/red fails CVD separation — so it renders as labelled rows
  where position and text carry the meaning.
- **UTF-8 is forced on the bundled Postgres cluster.** Without it, `initdb`
  inherits the Windows ANSI codepage and the server rejects em dashes and emoji
  in notes. Neon is UTF-8, so pinning it locally keeps the two identical.

---

## Not affiliated with LeetCode

Problem metadata comes from LeetCode's public endpoints and remains theirs.
