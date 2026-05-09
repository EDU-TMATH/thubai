import { NextResponse } from "next/server";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

import { getSession } from "@/app/lib/auth";
import { fetchCurrentUser } from "@/app/lib/judge-api";
import { getSubmissionHistoryForUser } from "@/app/lib/submission-history-db";

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
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  }

  const meResponse = await fetchCurrentUser(session, request);
  if ("error" in meResponse) {
    return NextResponse.json({ error: meResponse.error }, { status: meResponse.status });
  }

  const user = meResponse.data;
  const rows = await getSubmissionHistoryForUser(user.username, 3000);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Bạn chưa có bài nộp để tải xuống." }, { status: 404 });
  }

  const zip = new JSZip();
  let fileCounter = 0;

  for (const row of rows) {
    const folderName = `${toSafeTimestamp(row.savedAt)}_${sanitizeSegment(row.organizationShortName)}_${sanitizeSegment(row.submissionId)}`;
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

  const fileName = `lich-su-nop-bai-${sanitizeSegment(user.username)}.zip`;

  return new NextResponse(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}