import { NextResponse } from "next/server";

import { getSession, SESSION_COOKIE_NAME } from "@/app/lib/auth";
import { logoutFromJudge } from "@/app/lib/judge-api";

export async function POST(request: Request) {
  const session = await getSession();
  const response = NextResponse.json({ ok: true });

  if (session) {
    await logoutFromJudge(session, request).catch(() => null);
  }

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}