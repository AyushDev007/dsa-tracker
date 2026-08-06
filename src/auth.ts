import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      handle: string | null;
      leetcodeUsername: string | null;
      dailyGoal: number;
    } & DefaultSession["user"];
  }
}

const providers = [];

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

/**
 * Local-only escape hatch so the app is usable before any OAuth app exists.
 * Double-gated: the env flag must be on *and* we must not be in production, so
 * shipping with the flag accidentally set still cannot open a back door.
 */
export const devLoginEnabled =
  process.env.ENABLE_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Development login",
      credentials: {},
      async authorize() {
        const email = "demo@dsa-tracker.local";
        return prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name: "Demo User", handle: "demo", dailyGoal: 3 },
        });
      },
    }),
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  // The credentials provider cannot use database sessions, so the whole app
  // runs on JWT sessions and reads the profile fields from the token.
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user?.id) token.uid = user.id;

      // Refresh the denormalised profile bits on login and after a profile save
      // (`useSession().update()` fires trigger === "update").
      if (token.uid && (user || trigger === "update")) {
        const db = await prisma.user.findUnique({
          where: { id: token.uid as string },
          select: { handle: true, leetcodeUsername: true, dailyGoal: true, name: true, image: true },
        });
        if (db) {
          token.handle = db.handle;
          token.leetcodeUsername = db.leetcodeUsername;
          token.dailyGoal = db.dailyGoal;
          token.name = db.name;
          token.picture = db.image;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) {
        session.user.id = token.uid as string;
        session.user.handle = (token.handle as string | null) ?? null;
        session.user.leetcodeUsername = (token.leetcodeUsername as string | null) ?? null;
        session.user.dailyGoal = (token.dailyGoal as number) ?? 3;
      }
      return session;
    },
  },
  events: {
    /** Give every new account a usable public-profile handle. */
    async createUser({ user }) {
      if (!user.id) return;
      const base =
        (user.email?.split("@")[0] ?? user.name ?? "user")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 20) || "user";

      for (let i = 0; i < 25; i++) {
        const candidate = i === 0 ? base : `${base}${i}`;
        const taken = await prisma.user.findUnique({ where: { handle: candidate } });
        if (!taken) {
          await prisma.user.update({ where: { id: user.id }, data: { handle: candidate } });
          return;
        }
      }
    },
  },
  trustHost: true,
});

export const configuredProviders = {
  github: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  dev: devLoginEnabled,
};
