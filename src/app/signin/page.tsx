import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, configuredProviders } from "@/auth";
import { SignInButtons } from "./sign-in-buttons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Binary } from "lucide-react";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;
  if (session?.user) redirect(callbackUrl ?? "/dashboard");

  const nothingConfigured =
    !configuredProviders.github && !configuredProviders.google && !configuredProviders.dev;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Soft radial wash so the card doesn't float on a flat background. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(600px circle at 50% 0%, var(--accent-soft), transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-fg)]">
            <Binary className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">DSA Tracker</span>
        </Link>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl shadow-black/5">
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Sign in to pick up where you left off.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-[var(--hard)]/30 bg-[var(--hard-soft)] px-3 py-2 text-[0.8125rem] text-[var(--hard)]">
              {error === "OAuthAccountNotLinked"
                ? "That email is already registered with a different provider. Sign in the way you did the first time."
                : "Something went wrong signing you in. Please try again."}
            </div>
          )}

          {nothingConfigured ? (
            <div className="mt-5 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4 text-[0.8125rem] text-[var(--fg-muted)]">
              <p className="font-medium text-[var(--fg)]">No sign-in method configured</p>
              <p>
                Add GitHub or Google OAuth credentials to <code>.env</code>, or set{" "}
                <code>ENABLE_DEV_LOGIN=&quot;true&quot;</code> for a local demo account. See{" "}
                <code>.env.example</code> for the exact variable names.
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <SignInButtons
                providers={configuredProviders}
                callbackUrl={callbackUrl ?? "/dashboard"}
              />
            </div>
          )}

          <p className="mt-6 text-center text-xs text-[var(--fg-subtle)]">
            Your progress, notes and timings are stored against your account only.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-[var(--fg-muted)]">
          <Link href="/" className="hover:text-[var(--fg)]">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
