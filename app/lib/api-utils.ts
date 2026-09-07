import "server-only";

import { NextResponse } from "next/server";
import { logError } from "@/app/lib/server-log";

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function parseJsonBody<T>(request: Request): Promise<T | null> {
  return (await request.json().catch(() => null)) as T | null;
}

export async function withRouteErrorHandling(
  routeName: string,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    logError("route.unhandled", error, { routeName });
    return jsonError("Lỗi máy chủ. Vui lòng thử lại.", 500);
  }
}
