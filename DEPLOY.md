# Deploying

Everything in the repo is deploy-ready — migrations are committed, the build
command migrates and seeds automatically, and no secrets are tracked. What's
left needs your accounts, so it's yours to run.

Roughly 15 minutes end to end. All three services have a free tier that covers
this app comfortably.

---

## 1. Database — Neon (2 min)

1. Sign up at <https://neon.tech> and create a project. Pick the region closest
   to you; leave everything else default.
2. On the project dashboard, open **Connection string** and copy **two** values:
   - the **pooled** string (host contains `-pooler`) → this is `DATABASE_URL`
   - toggle **Direct connection** and copy that one → this is `DIRECT_URL`

Both look like:

```
postgresql://user:password@ep-something-123456.region.aws.neon.tech/neondb?sslmode=require
```

Prisma needs both: the app queries through the pooler, migrations run direct.

---

## 2. OAuth apps (5 min)

You need at least one. Both are free.

### GitHub

<https://github.com/settings/developers> → **New OAuth App**

| Field | Value |
|---|---|
| Application name | DSA Tracker |
| Homepage URL | `https://REPLACE-ME.vercel.app` |
| Authorization callback URL | `https://REPLACE-ME.vercel.app/api/auth/callback/github` |

Generate a client secret and keep both values. You'll come back and fix the URL
once Vercel assigns your real domain.

### Google

<https://console.cloud.google.com/apis/credentials> → **Create credentials** →
**OAuth client ID** → **Web application**

| Field | Value |
|---|---|
| Authorised JavaScript origins | `https://REPLACE-ME.vercel.app` |
| Authorised redirect URIs | `https://REPLACE-ME.vercel.app/api/auth/callback/google` |

If prompted to configure a consent screen first: **External**, fill in the app
name and your email, and leave it in **Testing** — that's fine for personal use
and lets you add yourself as a test user.

---

## 3. Generate an auth secret

```bash
npx auth secret
```

Copy the value it prints.

---

## 4. Push to GitHub

```bash
git remote add origin https://github.com/YOUR-USERNAME/dsa-tracker.git
```

```bash
git push -u origin main
```

(Create the empty repo on GitHub first, or install the `gh` CLI and run
`gh repo create dsa-tracker --private --source=. --push`.)

---

## 5. Deploy on Vercel (5 min)

1. Go to <https://vercel.com/new> and import the repo. Vercel detects Next.js —
   don't change the build settings, `vercel.json` already overrides them.
2. Before clicking Deploy, expand **Environment Variables** and add:

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string |
| `DIRECT_URL` | Neon **direct** connection string |
| `AUTH_SECRET` | output of `npx auth secret` |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_GITHUB_ID` | GitHub OAuth client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth client secret |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |

Skip the Google or GitHub pair if you only set up one — the sign-in page shows
whichever providers are configured.

3. Deploy. The build runs
   `prisma generate && prisma migrate deploy && tsx prisma/seed.ts && next build`,
   so the schema is created and the full problem catalogue is loaded on the first
   deploy.
   Expect 2–3 minutes.

---

## 6. Fix the callback URLs

Vercel will give you a domain like `dsa-tracker-abc123.vercel.app`. Now:

1. Add one more Vercel environment variable:
   `AUTH_URL` = `https://your-actual-domain.vercel.app`
2. Go back to your GitHub OAuth app and Google credentials and replace every
   `REPLACE-ME.vercel.app` with the real domain.
3. Redeploy (Vercel → Deployments → ⋯ → Redeploy) so `AUTH_URL` takes effect.

Sign in. Link your LeetCode username in Settings. Done.

---

## Troubleshooting

**`P1001: Can't reach database server`** — `DATABASE_URL` is wrong or missing
`?sslmode=require`. Neon requires SSL.

**Sign-in redirects to `localhost:3000`** — `AUTH_URL` isn't set, or you didn't
redeploy after setting it.

**`redirect_uri_mismatch`** — the callback URL in the OAuth provider doesn't
match your Vercel domain exactly. It's case- and slash-sensitive, and must
include `/api/auth/callback/github` (or `/google`).

**`OAuthAccountNotLinked`** — you signed up with GitHub and are now trying
Google (or vice versa) with the same email. Use the provider you started with.

**Build fails on `prisma migrate deploy`** — `DIRECT_URL` is missing or points
at the pooled endpoint. Migrations can't run through the pooler.

**Deployed but no problems listed** — the seed step failed. Check the build log;
usually the database URL. You can also run it by hand:

```bash
DATABASE_URL="your-neon-url" DIRECT_URL="your-direct-url" npx tsx prisma/seed.ts
```

---

## Custom domain (optional)

Vercel → Project → Settings → Domains → add yours. Then update `AUTH_URL` and
both OAuth callback URLs again, and redeploy.

---

## Keeping problem data fresh

Titles and difficulty rarely change, but acceptance rates drift. To refresh:

```bash
npm run problems:build
```

```bash
git commit -am "Refresh problem metadata" && git push
```

The push triggers a deploy, which re-seeds. It's an upsert by slug, so your
progress, notes and timings are untouched.
