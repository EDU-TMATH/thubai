import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/auth";
import { fetchCurrentUser } from "@/app/lib/judge-api";
import {
  deleteAllSubmissionHistory,
  deleteSubmissionHistoryById,
} from "@/app/lib/submission-history-db";
import { loadSettings } from "@/app/lib/settings";
import { deleteAllSubmissions, deleteSubmission } from "@/app/lib/submissions";

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

export async function DELETE(request: Request) {
  const auth = await requireSuperuser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as {
    all?: boolean;
    org?: string;
    username?: string;
    submissionId?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const settings = await loadSettings();
  const baseDir = settings.storagePrefix;

  if (body.all) {
    try {
      await deleteAllSubmissions(baseDir);
      await deleteAllSubmissionHistory();
    } catch {
      return NextResponse.json(
        { error: "Không thể xóa toàn bộ bài nộp. Vui lòng kiểm tra cấu hình thư mục lưu bài." },
        { status: 500 },
      );
    }
    return NextResponse.json({ deleted: "all" });
  }

  if (body.org && body.username && body.submissionId) {
    await deleteSubmission(baseDir, body.org, body.username, body.submissionId);
    await deleteSubmissionHistoryById(body.submissionId, body.username, body.org);
    return NextResponse.json({ deleted: body.submissionId });
  }

  return NextResponse.json({ error: "Thiếu tham số xóa." }, { status: 400 });
}
