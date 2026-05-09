import "server-only";

import { headers } from "next/headers";

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

export async function loginToJudge(
    request: Request,
    credentials: { username: string; password: string },
) {
    const response = await fetch(`${getJudgeApiBaseUrlFromRequest(request)}/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(credentials),
    });

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
    const response = await fetch(`${baseUrl}/me`, {
        method: "GET",
        headers: {
            Authorization: `${session.tokenType} ${session.accessToken}`,
        },
        cache: "no-store",
    });

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
    const response = await fetch(`${getJudgeApiBaseUrlFromRequest(request)}/auth/logout`, {
        method: "POST",
        headers: {
            Authorization: `${session.tokenType} ${session.accessToken}`,
            "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ refresh_token: session.refreshToken }),
    });

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