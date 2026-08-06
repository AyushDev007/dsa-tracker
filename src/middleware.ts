import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Cheap edge gate: only checks that a session cookie *exists* so it can run on
 * the edge without pulling Prisma into the middleware bundle. Every protected
 * route still calls `auth()` server-side and does the real verification — this
 * just avoids a flash of the app shell for logged-out visitors.
 */
const PROTECTED = [
  "/dashboard",
  "/problems",
  "/revision",
  "/sheets",
  "/notes",
  "/analytics",
  "/settings",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    const url = new URL("/signin", req.url);
    url.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
};
