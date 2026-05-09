import { NextResponse } from "next/server";

import {
  createSession,
  encodeSession,
  SESSION_COOKIE_NAME,
  validateLoginInput,
} from "@/app/lib/auth";
import { fetchCurrentUser, loginToJudge } from "@/app/lib/judge-api";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const validation = validateLoginInput(body ?? {});
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const loginResponse = await loginToJudge(request, validation);
  if ("error" in loginResponse) {
    return NextResponse.json({ error: loginResponse.error }, { status: loginResponse.status });
  }

  const session = createSession({
    username: validation.username,
    accessToken: loginResponse.data.access_token,
    refreshToken: loginResponse.data.refresh_token,
    tokenType: loginResponse.data.token_type,
  });

  const meResponse = await fetchCurrentUser(session, request);
  if ("error" in meResponse) {
    return NextResponse.json({ error: meResponse.error }, { status: meResponse.status });
  }

  const response = NextResponse.json({ session });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: encodeSession(session),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}