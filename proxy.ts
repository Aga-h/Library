import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { REPORT_PATH, SESSION_COOKIE, verifyReportToken, verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/auth"];

// PWA install assets. iOS fetches these *unauthenticated* when adding to the home screen,
// so gating them behind login makes the app silently uninstallable and stops the service
// worker from ever registering. None of them contain user data.
const PUBLIC_FILES = new Set([
  "/manifest.webmanifest",
  "/sw.js",
  "/apple-touch-icon.png",
  "/favicon.ico",
]);

function isPublic(pathname: string): boolean {
  // Exact-or-boundary match: a plain startsWith would make "/loginanything" public too.
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (PUBLIC_FILES.has(pathname)) return true;
  if (pathname.startsWith("/icons/")) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();
  if (pathname.startsWith("/_next")) return NextResponse.next();

  const secret = process.env.AUTH_SECRET;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!secret || !(await verifySessionToken(token, secret))) {
    // The nightly review job has no session. It may read the one review endpoint with its own
    // read-only token — exact path, GET only — and nothing else.
    if (
      pathname === REPORT_PATH &&
      request.method === "GET" &&
      (await verifyReportToken(request.headers.get("authorization"), process.env.REPORT_TOKEN))
    ) {
      return NextResponse.next();
    }

    // API callers get JSON. Redirecting them to the HTML login page produced a 200 that
    // fetch() treated as success, so res.json() threw and forms hung on "Saving…" forever.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
