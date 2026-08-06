# DSA Tracker

A full-stack interview-prep tracker for 311 curated LeetCode problems, organised
**by topic and by pattern**, with spaced-repetition revision, notes, a solve
heatmap, and LeetCode sync.

Built with Next.js 15 (App Router), TypeScript, Tailwind v4, Prisma + PostgreSQL
and Auth.js v5.

---

## Quick start

Three terminals' worth of commands, but only the first time.

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

### Start the database

You need a PostgreSQL 16 database. Pick whichever is least friction:

**A. Zero-install (bundled Postgres).** Runs a real Postgres server out of
`.postgres/` — no Docker, no admin rights, no cloud account. Leave it running in
its own terminal.

```bash
npm run db:local
```

**B. Docker.**

```bash
docker compose up -d
```

**C. Neon** (also what you'll use in production) — create a free project at
[neon.tech](https://neon.tech) and paste both connection strings into `.env`:
`DATABASE_URL` = the pooled string, `DIRECT_URL` = the unpooled one.

All three work with the default `.env`, except Neon which needs its own URLs.

### Create the schema and load the problems

```bash
npm run setup
```

That runs `prisma generate`, pushes the schema and seeds all 311 problems with
their topics, patterns, companies and sheet memberships.

### Run it

```bash
npm run dev
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
| **Browse by topic or pattern** — 22 topics, 45 patterns, filter/search/sort, or group into collapsible accordions with per-group progress | `/problems` |
| **Company filters** — narrow to what Amazon, Google, Meta… tend to ask | `/problems?company=…` |
| **Spaced repetition** — rate a solve *struggled / ok / confident* and it reschedules on a 1→3→7→21→45→90 day ladder | `/revision` |
| **Notes** — markdown write-up plus a syntax-highlighted solution and complexity per problem, searchable across everything | `/problems/[slug]`, `/notes` |
| **Timer + attempt log** — wall-clock timer that survives a backgrounded tab, hint flag, full attempt history | `/problems/[slug]` |
| **Heatmap + streaks** — a year of activity, merged with your real LeetCode submission calendar | `/dashboard` |
| **Daily goal ring** | `/dashboard` |
| **Analytics** — weak-area detection, coverage by topic and pattern, weekly trend, median solve time, first-try and hint rates | `/analytics` |
| **Curated sheets** — Blind 75, NeetCode 150, Striver SDE Sheet, Grind 75, layered over the same problems | `/sheets` |
| **LeetCode sync** — solve counts, contest rating, submission calendar, and auto-marking from recent accepted submissions | `/settings` |
| **Public profile** — opt-in read-only page with heatmap and stats | `/u/[handle]` |
| **CSV export + reset** | `/settings` |

### On the LeetCode integration

LeetCode has no official public API. This uses the same unauthenticated GraphQL
endpoint the profile page itself calls, which means:

- It needs **only a username** — no password, no session cookie, nothing stored
  that could compromise the account.
- It can read solve counts, the submission calendar, contest rating, and the
  **~20 most recent** accepted submissions.
- It **cannot** read your full solved list or your submitted source code — those
  sit behind the session cookie, which this app deliberately does not touch.

So auto-marking catches up gradually as you solve, rather than backfilling
everything at once. It never un-marks anything. Because the endpoint is
unofficial it can change without notice; every call is defensive and a failure
degrades to "sync unavailable" rather than breaking a page.

### On the problem data

`data/curated.ts` is hand-maintained: which problems are included, their topic,
pattern, sheet memberships and company tags. Everything else — exact title,
question number, difficulty, acceptance rate, premium flag — is pulled from
LeetCode's public problem list by a build script and written to
`data/problems.json`, which the seed reads:

```bash
npm run problems:build
```

The generated JSON is committed, so seeding and deploys never need network
access. Re-run it only after editing the curated list; it validates every slug
against LeetCode and fails loudly on a typo.

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
so the schema is migrated and all 311 problems are seeded automatically on every
deploy. The seed is idempotent — it upserts by slug and never touches user data.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (no database needed) |
| `npm run db:local` | Start the bundled Postgres |
| `npm run setup` | Generate client + push schema + seed problems |
| `npm run db:seed` | Re-seed the problem catalogue (idempotent) |
| `npm run db:demo` | Generate demo progress for the first user |
| `npm run db:studio` | Prisma Studio |
| `npm run db:migrate` | Create a migration after a schema change |
| `npm run problems:build` | Rebuild `data/problems.json` from LeetCode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

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
