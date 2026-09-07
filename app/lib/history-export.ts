import "server-only";

import type { SubmissionHistoryRow } from "@/app/lib/submission-history-db";

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export function toHistoryCsv(rows: SubmissionHistoryRow[]) {
  const header = [
    "id",
    "submissionId",
    "username",
    "displayName",
    "organizationId",
    "organizationShortName",
    "organizationName",
    "fileCount",
    "totalBytes",
    "savedAt",
    "destination",
  ];

  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.submissionId,
        row.username,
        row.displayName,
        row.organizationId,
        row.organizationShortName,
        row.organizationName,
        row.fileCount,
        row.totalBytes,
        row.savedAt,
        row.destination,
      ]
        .map((value) => escapeCsvCell(String(value)))
        .join(","),
    ),
  ];

  return `${lines.join("\n")}\n`;
}
