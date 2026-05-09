import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

export type UserSession = {
  username: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  loginAt: string;
};

export const SESSION_COOKIE_NAME = "thubai-session";

function normalizeValue(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getSessionSecret() {
  return process.env.SESSION_SECRET ?? "thubai-local-secret";
}

function sign(payload: string) {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSession(input: {
  username: string;
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
}): UserSession {
  return {
    username: normalizeValue(input.username),
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    tokenType: input.tokenType ?? "Bearer",
    loginAt: new Date().toISOString(),
  };
}

export function encodeSession(session: UserSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }
  
  if (!safeCompare(sign(payload), signature)) {
    // CRITICAL: Signature mismatch - cookie may be corrupted or from different secret
    console.warn(
      "[AUTH] Session signature verification failed. Cookie may be stale or corrupted.",
      { cookieLength: token.length, hasPayload: !!payload, hasSignature: !!signature },
    );
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<UserSession>;

    if (
      !parsed.username
      || !parsed.accessToken
      || !parsed.refreshToken
      || !parsed.tokenType
      || !parsed.loginAt
    ) {
      console.warn("[AUTH] Session validation failed: missing required fields", {
        hasUsername: !!parsed.username,
        hasAccessToken: !!parsed.accessToken,
        hasRefreshToken: !!parsed.refreshToken,
        hasTokenType: !!parsed.tokenType,
        hasLoginAt: !!parsed.loginAt,
      });
      return null;
    }

    const session = {
      username: normalizeValue(parsed.username),
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      tokenType: parsed.tokenType,
      loginAt: parsed.loginAt,
    };
    
    console.log("[AUTH] Session loaded successfully", { username: session.username, loginAt: session.loginAt });
    return session;
  } catch (error) {
    console.error("[AUTH] Session parse error:", error instanceof Error ? error.message : error);
    return null;
  }
}

export function validateLoginInput(input: {
  username?: string;
  password?: string;
}) {
  const username = normalizeValue(input.username ?? "");
  const password = input.password ?? "";

  if (!username) {
    return { error: "Vui lòng nhập tài khoản." };
  }

  if (!password) {
    return { error: "Vui lòng nhập mật khẩu." };
  }

  if (username.length > 80 || password.length > 200) {
    return { error: "Thông tin đăng nhập vượt quá độ dài cho phép." };
  }

  return { username, password };
}