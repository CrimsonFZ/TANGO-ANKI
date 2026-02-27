import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "auth";
const PROTECTED_API_PREFIXES = [
  "/api/stats",
  "/api/study",
  "/api/review",
  "/api/grade",
  "/api/toggle",
  "/api/rollback",
  "/api/wordsByIds",
  "/api/generateExample",
  "/api/resetProgress",
  "/api/session",
  "/api/me/stats",
  "/api/checkin",
  "/api/wallet",
];
const PROTECTED_PAGES = ["/", "/study", "/review", "/me"];

function isProtectedApi(pathname: string): boolean {
  return PROTECTED_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (pathname.startsWith("/auth/")) {
    if (sessionCookie) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (PROTECTED_PAGES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  if (!isProtectedApi(pathname)) {
    return NextResponse.next();
  }

  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
