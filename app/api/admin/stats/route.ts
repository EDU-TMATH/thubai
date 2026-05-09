import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/auth";
import { fetchCurrentUser } from "@/app/lib/judge-api";
import { getSubmissionHistoryAll } from "@/app/lib/submission-history-db";

export const runtime = "nodejs";

type AdminAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

async function requireSuperuser(request: Request) {
  const session = await getSession();
  if (!session) {
    return { ok: false, status: 401, error: "Phiên đăng nhập đã hết hạn." } satisfies AdminAuthResult;
  }

  const meResult = await fetchCurrentUser(session, request);
  if ("error" in meResult) {
    return {
      ok: false,
      status: meResult.status,
      error: meResult.error ?? "Không thể xác thực người dùng.",
    } satisfies AdminAuthResult;
  }

  if (!meResult.data.is_superuser) {
    return { ok: false, status: 403, error: "Không có quyền truy cập." } satisfies AdminAuthResult;
  }

  return { ok: true } satisfies AdminAuthResult;
}

export async function GET(request: Request) {
  const auth = await requireSuperuser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const historyRows = await getSubmissionHistoryAll(3000);
  const submissions = historyRows.map((row) => ({
    submissionId: row.submissionId,
    org: row.organizationShortName,
    username: row.username,
    displayName: row.displayName,
    organizationName: row.organizationName,
    savedAt: row.savedAt,
    fileCount: row.fileCount,
    totalBytes: row.totalBytes,
  }));

  return NextResponse.json({ submissions });
}
