import { NextResponse } from "next/server";
import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";

import { requireSuperuser } from "@/app/lib/admin-auth";
import { withRouteErrorHandling } from "@/app/lib/api-utils";
import {
  getHistoryDbFile,
  getSettingsFile,
} from "@/app/lib/env";
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

function getDateKey(iso: string) {
  return iso.slice(0, 10);
}

function buildDailyTrend(rows: Array<{ savedAt: string }>, days = 14) {
  const counts = new Map<string, number>();
  const today = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - offset);
    const key = day.toISOString().slice(0, 10);
    counts.set(key, 0);
  }

  for (const row of rows) {
    const key = getDateKey(row.savedAt);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
}

function buildOrganizationBreakdown(
  rows: Array<{ organizationShortName: string; organizationName: string; fileCount: number; totalBytes: number }>,
) {
  const map = new Map<string, { org: string; organizationName: string; count: number; files: number; bytes: number }>();
  for (const row of rows) {
    const key = row.organizationShortName;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.files += row.fileCount;
      existing.bytes += row.totalBytes;
    } else {
      map.set(key, {
        org: row.organizationShortName,
        organizationName: row.organizationName,
        count: 1,
        files: row.fileCount,
        bytes: row.totalBytes,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
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
      pathExists(getSettingsFile()),
      pathExists(getHistoryDbFile()),
      getStorageStatus(settings.storagePrefix),
    ]);

    const dailyTrend = buildDailyTrend(historyRows);
    const organizationBreakdown = buildOrganizationBreakdown(historyRows);

    return NextResponse.json({
      submissions,
      analytics: {
        dailyTrend,
        organizationBreakdown,
      },
      system: {
        judgeApi: {
          status: "ok",
          message: "Kết nối Judge API đang hoạt động.",
        },
        storage,
        files: {
          settingsFile: getSettingsFile(),
          settingsExists,
          historyDbFile: getHistoryDbFile(),
          historyDbExists,
        },
      },
    });
  });
}
