import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "t2p_dashboard_session";
const SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas públicas y assets internos.
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/logout") ||
    pathname.startsWith("/api/refresh") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  if (!SESSION_SECRET) {
    return new NextResponse("Dashboard session secret is not configured.", {
      status: 500,
    });
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (session === SESSION_SECRET) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
