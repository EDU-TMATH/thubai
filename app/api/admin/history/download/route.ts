import { NextResponse } from "next/server";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

import { requireSuperuser } from "@/app/lib/admin-auth";
import { withRouteErrorHandling } from "@/app/lib/api-utils";
import { getSubmissionHistoryAll } from "@/app/lib/submission-history-db";

export const runtime = "nodejs";

function sanitizeSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "unknown";
}

function toSafeTimestamp(iso: string) {
  return iso.replace(/[:.]/g, "-");
}

export async function GET(request: Request) {
  return withRouteErrorHandling("admin.history.download", async () => {
    const auth = await requireSuperuser(request);
    if (!auth.ok) {
      return auth.response;
    }

    const rows = await getSubmissionHistoryAll(10000);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Chưa có bài nộp để tải xuống." }, { status: 404 });
    }

    const zip = new JSZip();
    let fileCounter = 0;

    for (const row of rows) {
      const organizationFolder = sanitizeSegment(row.organizationShortName);
      const userFolder = sanitizeSegment(row.username);
      const submissionFolder = `${toSafeTimestamp(row.savedAt)}_${sanitizeSegment(row.submissionId)}`;
      const folderName = `${organizationFolder}/${userFolder}/${submissionFolder}`;
      const destination = row.destination;

      let entries;
      try {
        entries = await readdir(destination, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const fullPath = path.join(destination, entry.name);
        try {
          const data = await readFile(fullPath);
          zip.file(`${folderName}/${entry.name}`, data);
          fileCounter += 1;
        } catch {
          // Skip unreadable files and continue bundling others.
        }
      }
    }

    if (fileCounter === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy file bài nộp hợp lệ để tải xuống." },
        { status: 404 },
      );
    }

    const archive = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const fileName = `lich-su-nop-bai-toan-he-thong-${toSafeTimestamp(new Date().toISOString())}.zip`;

    return new NextResponse(new Uint8Array(archive), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
