import { redirect } from "next/navigation";

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
  console.log("[HISTORY:PAGE] Loading history for", { username: currentUser.username, displayName: currentUser.display_name });
  
  const rows = await getSubmissionHistoryForUser(currentUser.username);
  console.log("[HISTORY:PAGE] Loaded history", { username: currentUser.username, rowCount: rows.length });

  return (
    <main className="page-grid mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="glass-panel rounded-4xl px-8 py-10 lg:px-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-(--accent-deep)">
              Tra cứu lịch sử nộp bài
            </p>
            <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">Lịch sử của bạn</h1>
            <p className="text-base leading-8 text-[rgba(31,26,23,0.74)]">
              Tài khoản: <span className="font-semibold">{currentUser.display_name}</span> (@{currentUser.username})
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="/submit"
              className="rounded-2xl border border-(--line) bg-white/70 px-4 py-2 text-sm font-semibold text-(--accent-deep) transition hover:bg-white"
            >
              ← Trang nộp bài
            </a>
            {rows.length > 0 && (
              <a
                href="/api/history/download"
                className="rounded-2xl bg-(--accent) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--accent-deep)"
              >
                Download tất cả bài nộp
              </a>
            )}
            {currentUser.is_superuser && (
              <a
                href="/admin/history"
                className="rounded-2xl bg-(--accent) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--accent-deep)"
              >
                Xem toàn hệ thống →
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-4xl p-6 lg:p-8">
        {rows.length === 0 ? (
          <div className="rounded-3xl border border-(--line) bg-white/65 px-6 py-10 text-center text-sm text-[rgba(31,26,23,0.68)]">
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