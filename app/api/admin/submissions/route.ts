import { NextResponse } from "next/server";

import { requireSuperuser } from "@/app/lib/admin-auth";
import { jsonError, parseJsonBody, withRouteErrorHandling } from "@/app/lib/api-utils";
import { logError } from "@/app/lib/server-log";
import {
  deleteAllSubmissionHistory,
  deleteSubmissionHistoryById,
  getSubmissionHistoryById,
} from "@/app/lib/submission-history-db";
import { loadSettings } from "@/app/lib/settings";
import {
  deleteAllSubmissions,
  deleteSubmissionAtDestination,
} from "@/app/lib/submissions";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  return withRouteErrorHandling("admin.submissions.delete", async () => {
    const auth = await requireSuperuser(request);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await parseJsonBody<{
      all?: boolean;
      org?: string;
      username?: string;
      submissionId?: string;
    }>(request);

    if (!body) {
      return jsonError("Dữ liệu không hợp lệ.", 400);
    }

    const settings = await loadSettings();
    const baseDir = settings.storagePrefix;

    if (body.all) {
      try {
        await deleteAllSubmissions(baseDir);
        await deleteAllSubmissionHistory();
      } catch (error) {
        logError("admin.submissions.delete_all_failed", error, { baseDir });
        return jsonError(
          "Không thể xóa toàn bộ bài nộp. Vui lòng kiểm tra cấu hình thư mục lưu bài.",
          500,
        );
      }
      return NextResponse.json({ deleted: "all" });
    }

    if (body.org && body.username && body.submissionId) {
      const submission = await getSubmissionHistoryById(
        body.submissionId,
        body.username,
        body.org,
      );
      if (!submission) {
        return jsonError("Không tìm thấy bài nộp.", 404);
      }

      try {
        await deleteSubmissionAtDestination(submission.destination, submission.submissionId);
        await deleteSubmissionHistoryById(
          submission.submissionId,
          submission.username,
          submission.organizationShortName,
        );
      } catch (error) {
        logError("admin.submissions.delete_one_failed", error, {
          submissionId: body.submissionId,
        });
        return jsonError("Không thể xóa bài nộp.", 500);
      }
      return NextResponse.json({ deleted: body.submissionId });
    }

    return jsonError("Thiếu tham số xóa.", 400);
  });
}
