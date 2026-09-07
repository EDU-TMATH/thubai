import { redirect } from "next/navigation";
import {
  ArrowLeftIcon,
  ClockCounterClockwiseIcon,
  DownloadSimpleIcon,
  FilesIcon,
} from "@phosphor-icons/react/ssr";

import { PageHeader } from "@/app/components/page-header";
import { getSession } from "@/app/lib/auth";
import { fetchCurrentUser } from "@/app/lib/judge-api";
import { getSubmissionHistoryForUser } from "@/app/lib/submission-history-db";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export default async function HistoryPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const meResponse = await fetchCurrentUser(session);
  if ("error" in meResponse) {
    redirect("/login");
  }

  const currentUser = meResponse.data;
  const rows = await getSubmissionHistoryForUser(currentUser.username);

  return (
    <main className="page-grid mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        eyebrow={
          <>
            <ClockCounterClockwiseIcon size={20} weight="duotone" aria-hidden="true" />
            Tra cứu lịch sử nộp bài
          </>
        }
        title="Lịch sử của bạn"
        description={
          <>
            Tài khoản: <span className="font-semibold">{currentUser.display_name}</span> (@
            {currentUser.username})
          </>
        }
        actions={
          <>
            <a
              href="/submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-(--line) bg-white/70 px-4 py-2.5 text-sm font-semibold text-(--accent-deep) transition hover:bg-white"
            >
              <ArrowLeftIcon size={18} weight="bold" aria-hidden="true" />
              Trang nộp bài
            </a>
            {rows.length > 0 && (
              <a
                href="/api/history/download"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-(--accent) px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-(--accent-deep)"
              >
                <DownloadSimpleIcon size={18} weight="bold" aria-hidden="true" />
                Tải xuống theo tổ chức
              </a>
            )}
            {currentUser.is_superuser && (
              <a
                href="/admin/history"
                className="inline-flex items-center justify-center rounded-2xl border border-(--line) bg-white/70 px-4 py-2.5 text-sm font-semibold text-(--accent-deep) transition hover:bg-white"
              >
                Xem toàn hệ thống →
              </a>
            )}
          </>
        }
      />

      <section className="glass-panel rounded-4xl p-6 lg:p-8">
        {rows.length === 0 ? (
          <div className="rounded-3xl border border-(--line) bg-white/65 px-6 py-10 text-center text-sm text-[rgba(31,26,23,0.68)]">
            <FilesIcon className="mx-auto mb-3 text-(--accent)" size={34} weight="duotone" aria-hidden="true" />
            Bạn chưa có lần nộp bài nào.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-(--line) bg-white/70">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--line) bg-white/60 text-left">
                  <th className="px-4 py-3">Thời gian nộp</th>
                  <th className="px-4 py-3">Tổ chức</th>
                  <th className="px-4 py-3 text-right">Số file</th>
                  <th className="px-4 py-3 text-right">Dung lượng</th>
                  <th className="px-4 py-3">Mã nộp</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-(--line) last:border-0">
                    <td className="px-4 py-3">{formatDateTime(row.savedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{row.organizationShortName}</div>
                      <div className="text-xs text-[rgba(31,26,23,0.65)]">{row.organizationName}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{row.fileCount}</td>
                    <td className="px-4 py-3 text-right">{formatBytes(row.totalBytes)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.submissionId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
