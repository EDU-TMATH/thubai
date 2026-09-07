import { NextResponse } from "next/server";
import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";

import { requireSuperuser } from "@/app/lib/admin-auth";
import { withRouteErrorHandling } from "@/app/lib/api-utils";
import { HISTORY_DB_FILE, SETTINGS_FILE } from "@/app/lib/env";
import { getSubmissionHistoryAll } from "@/app/lib/submission-history-db";
import { loadSettings } from "@/app/lib/settings";

export const runtime = "nodejs";

async function pathExists(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function getStorageStatus(storagePath: string) {
  try {
    await mkdir(storagePath, { recursive: true });
    await access(storagePath, constants.R_OK | constants.W_OK);
    return {
      path: storagePath,
      writable: true,
      status: "ok" as const,
      message: "Thư mục lưu bài có thể đọc/ghi.",
    };
  } catch {
    return {
      path: storagePath,
      writable: false,
      status: "error" as const,
      message: "Không thể ghi vào thư mục lưu bài.",
    };
  }
}

export async function GET(request: Request) {
  return withRouteErrorHandling("admin.stats", async () => {
    const auth = await requireSuperuser(request);
    if (!auth.ok) {
      return auth.response;
    }

    const settings = await loadSettings();
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

    const [settingsExists, historyDbExists, storage] = await Promise.all([
      pathExists(SETTINGS_FILE),
      pathExists(HISTORY_DB_FILE),
      getStorageStatus(settings.storagePrefix),
    ]);

    return NextResponse.json({
      submissions,
      system: {
        judgeApi: {
          status: "ok",
          message: "Kết nối Judge API đang hoạt động.",
        },
        storage,
        files: {
          settingsFile: SETTINGS_FILE,
          settingsExists,
          historyDbFile: HISTORY_DB_FILE,
          historyDbExists,
        },
      },
    });
  });
}
