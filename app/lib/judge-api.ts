import "server-only";

import { headers } from "next/headers";
import { logWarn } from "@/app/lib/server-log";

import type { UserSession } from "@/app/lib/auth";

export type OrganizationSummary = {
    id: number;
    name: string;
    short_name: string;
};

export type CurrentUser = {
    id: number;
    username: string;
    display_name: string;
    organization: OrganizationSummary | null;
    organizations: OrganizationSummary[];
    is_superuser: boolean;
    is_staff: boolean;
};

export type LoginTokens = {
    access_token: string;
    refresh_token: string;
    token_type: string;
    access_expires_in: number;
    refresh_expires_in: number;
};

const DEFAULT_JUDGE_API_TIMEOUT_MS = 8000;
const DEFAULT_JUDGE_API_RETRY_COUNT = 2;
const DEFAULT_JUDGE_API_RETRY_DELAY_MS = 300;

function readPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
}

const JUDGE_API_TIMEOUT_MS = readPositiveIntEnv(
  "JUDGE_API_TIMEOUT_MS",
  DEFAULT_JUDGE_API_TIMEOUT_MS,
);
const JUDGE_API_RETRY_COUNT = readPositiveIntEnv(
  "JUDGE_API_RETRY_COUNT",
  DEFAULT_JUDGE_API_RETRY_COUNT,
);
const JUDGE_API_RETRY_DELAY_MS = readPositiveIntEnv(
  "JUDGE_API_RETRY_DELAY_MS",
  DEFAULT_JUDGE_API_RETRY_DELAY_MS,
);

function normalizeBaseUrl(value: string) {
    return value.replace(/\/+$/, "");
}

function buildOriginFromHeaders(headerList: Headers) {
    const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
    if (!host) {
        throw new Error("Missing host header for Judge API origin resolution.");
    }

    const proto = headerList.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
}

export async function getJudgeApiBaseUrl() {
    if (process.env.JUDGE_API_BASE_URL) {
        return normalizeBaseUrl(process.env.JUDGE_API_BASE_URL);
    }

    return `${buildOriginFromHeaders(await headers())}/api/v3`;
}

export function getJudgeApiBaseUrlFromRequest(request: Request) {
    if (process.env.JUDGE_API_BASE_URL) {
        return normalizeBaseUrl(process.env.JUDGE_API_BASE_URL);
    }

    const url = new URL(request.url);
    return `${url.protocol}//${url.host}/api/v3`;
}

async function parseErrorMessage(response: Response) {
    const payload = (await response.json().catch(() => null)) as
        | { detail?: string }
        | null;

    return payload?.detail ?? "Judge API request failed.";
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableStatus(status: number) {
  return status >= 500 && status <= 599;
}

async function judgeFetch(url: string, init: RequestInit, context: string): Promise<Response> {
  const maxAttempts = JUDGE_API_RETRY_COUNT + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), JUDGE_API_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      if (
        isRetryableStatus(response.status)
        && attempt < maxAttempts
      ) {
        logWarn("judge_api.retry_http", {
          context,
          attempt,
          maxAttempts,
          status: response.status,
        });
        await delay(JUDGE_API_RETRY_DELAY_MS * attempt);
        continue;
      }

      return response;
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }

      logWarn("judge_api.retry_network", {
        context,
        attempt,
        maxAttempts,
      });
      await delay(JUDGE_API_RETRY_DELAY_MS * attempt);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("Judge API request failed after retries.");
}

function judgeConnectivityError() {
  return {
    error: "Không thể kết nối Judge API. Vui lòng thử lại sau.",
    status: 503,
  };
}

export async function loginToJudge(
    request: Request,
    credentials: { username: string; password: string },
) {
    let response: Response;
    try {
        response = await judgeFetch(
            `${getJudgeApiBaseUrlFromRequest(request)}/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                cache: "no-store",
                body: JSON.stringify(credentials),
            },
            "auth.login",
        );
    } catch {
        return judgeConnectivityError();
    }

    if (!response.ok) {
        return {
            error: await parseErrorMessage(response),
            status: response.status,
        };
    }

    return {
        data: (await response.json()) as LoginTokens,
        status: response.status,
    };
}

export async function fetchCurrentUser(session: UserSession, request?: Request) {
    const baseUrl = request
        ? getJudgeApiBaseUrlFromRequest(request)
        : await getJudgeApiBaseUrl();
    let response: Response;
    try {
        response = await judgeFetch(
            `${baseUrl}/me`,
            {
                method: "GET",
                headers: {
                    Authorization: `${session.tokenType} ${session.accessToken}`,
                },
                cache: "no-store",
            },
            "auth.me",
        );
    } catch {
        return judgeConnectivityError();
    }

    if (!response.ok) {
        return {
            error: await parseErrorMessage(response),
            status: response.status,
        };
    }

    return {
        data: (await response.json()) as CurrentUser,
        status: response.status,
    };
}

export async function logoutFromJudge(session: UserSession, request: Request) {
    let response: Response;
    try {
        response = await judgeFetch(
            `${getJudgeApiBaseUrlFromRequest(request)}/auth/logout`,
            {
                method: "POST",
                headers: {
                    Authorization: `${session.tokenType} ${session.accessToken}`,
                    "Content-Type": "application/json",
                },
                cache: "no-store",
                body: JSON.stringify({ refresh_token: session.refreshToken }),
            },
            "auth.logout",
        );
    } catch {
        return judgeConnectivityError();
    }

    if (!response.ok) {
        return {
            error: await parseErrorMessage(response),
            status: response.status,
        };
    }

    return {
        data: (await response.json().catch(() => ({ detail: "Logged out successfully." }))) as {
            detail?: string;
        },
        status: response.status,
    };
}

export function extractOrganizations(user: CurrentUser) {
    const byId = new Map<number, OrganizationSummary>();

    if (user.organization) {
        byId.set(user.organization.id, user.organization);
    }

    for (const organization of user.organizations) {
        byId.set(organization.id, organization);
    }

    return Array.from(byId.values());
}