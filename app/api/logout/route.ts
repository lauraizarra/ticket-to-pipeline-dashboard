import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "t2p_dashboard_session";

export function GET(request: NextRequest) {
  const loginUrl = new URL("/login?logout=1", request.url);
  const response = NextResponse.redirect(loginUrl);

  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
