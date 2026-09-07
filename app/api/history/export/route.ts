import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/auth";
import { fetchCurrentUser } from "@/app/lib/judge-api";
import { toHistoryCsv } from "@/app/lib/history-export";
import { getSubmissionHistoryForUser } from "@/app/lib/submission-history-db";

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
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  }

  const meResponse = await fetchCurrentUser(session, request);
  if ("error" in meResponse) {
    return NextResponse.json({ error: meResponse.error }, { status: meResponse.status });
  }

  const url = new URL(request.url);
  const keyword = firstParam(url.searchParams.get("q") ?? "").trim();
  const rows = (await getSubmissionHistoryForUser(meResponse.data.username, 10000)).filter((row) =>
    matchesKeyword(
      [row.username, row.displayName, row.organizationShortName, row.organizationName, row.submissionId]
        .join(" "),
      keyword,
    ),
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Bạn chưa có dữ liệu để xuất." }, { status: 404 });
  }

  const csv = toHistoryCsv(rows);
  const fileName = `lich-su-nop-bai-${meResponse.data.username}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
