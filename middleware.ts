import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-cookie";

const AUTH_PAGES = new Set(["/login", "/signup"]);

const PROTECTED_PREFIXES = [
  "/feed",
  "/reels",
  "/explore",
  "/profile",
  "/library",
  "/studio",
  "/agent",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

  if (signedIn && (pathname === "/" || AUTH_PAGES.has(pathname))) {
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  if (!signedIn && isProtected(pathname)) {
    const login = new URL("/login", request.url);
    if (pathname !== "/feed") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
