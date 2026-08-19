import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "t2p_dashboard_session";
const PASSWORD = process.env.DASHBOARD_PASSWORD;
const SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET;

export async function POST(request: NextRequest) {
  if (!PASSWORD || !SESSION_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Dashboard password is not configured." },
      { status: 500 }
    );
  }

  let body: { password?: string; next?: string } = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  if (body.password !== PASSWORD) {
    return NextResponse.json(
      { ok: false, error: "Contraseña incorrecta." },
      { status: 401 }
    );
  }

  const redirectTo =
    body.next && body.next.startsWith("/") && !body.next.startsWith("//")
      ? body.next
      : "/";

  const response = NextResponse.json({ ok: true, redirectTo });

  response.cookies.set({
    name: SESSION_COOKIE,
    value: SESSION_SECRET,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
