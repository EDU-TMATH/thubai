import { NextResponse } from "next/server";

import { requireSuperuser } from "@/app/lib/admin-auth";
import { toHistoryCsv } from "@/app/lib/history-export";
import { getSubmissionHistoryAll } from "@/app/lib/submission-history-db";

export const runtime = "nodejs";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function matchesKeyword(value: string, keyword: string) {
  if (!keyword) {
    return true;
  }

  return value.toLowerCase().includes(keyword.toLowerCase());
}

export async function GET(request: Request) {
  const auth = await requireSuperuser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const keyword = firstParam(url.searchParams.get("q") ?? "").trim();
  const rows = (await getSubmissionHistoryAll(10000)).filter((row) =>
    matchesKeyword(
      [row.username, row.displayName, row.organizationShortName, row.organizationName, row.submissionId]
        .join(" "),
      keyword,
    ),
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Không có dữ liệu để xuất." }, { status: 404 });
  }

  const csv = toHistoryCsv(rows);
  const fileName = `lich-su-nop-bai-toan-he-thong.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
