import { redirect } from "next/navigation";

import { getSession } from "@/app/lib/auth";
import { fetchCurrentUser } from "@/app/lib/judge-api";
import { getSubmissionHistoryAll } from "@/app/lib/submission-history-db";

type AdminHistoryPageProps = {
  searchParams: Promise<{ q?: string }>;
};

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

export default async function AdminHistoryPage({ searchParams }: AdminHistoryPageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const meResponse = await fetchCurrentUser(session);
  if ("error" in meResponse) {
    redirect("/login");
  }

  const currentUser = meResponse.data;
  if (!currentUser.is_superuser) {
    redirect("/submit");
  }

  const params = await searchParams;
  const keyword = (params.q ?? "").trim().toLowerCase();

  const rows = await getSubmissionHistoryAll(3000);
  const filteredRows = keyword
    ? rows.filter((row) =>
        [row.username, row.displayName, row.organizationShortName, row.organizationName]
          .join(" ")
          .toLowerCase()
          .includes(keyword),
      )
    : rows;

  const uniqueStudents = new Set(filteredRows.map((row) => row.username)).size;
  const totalFiles = filteredRows.reduce((sum, row) => sum + row.fileCount, 0);

  return (
    <main className="page-grid mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="glass-panel rounded-4xl px-8 py-10 lg:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-(--accent-deep)">
              Quản trị tra cứu lịch sử
            </p>
            <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
              Toàn bộ lịch sử nộp bài
            </h1>
            <p className="text-base leading-8 ext-[rgba(31,26,23,0.74)]">
              Quản trị viên có thể tra cứu theo học sinh hoặc tổ chức.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/admin"
              className="rounded-2xl border border-(--line) bg-white/70 px-4 py-2 text-sm font-semibold text-(--accent-deep) transition hover:bg-white"
            >
              ← Quay lại quản trị
            </a>
            <a
              href="/api/admin/history/download"
              className="rounded-2xl bg-(--accent) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--accent-deep)"
            >
              Download tất cả bài nộp
            </a>
            <a
              href="/history"
              className="rounded-2xl bg-(--accent) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--accent-deep)"
            >
              Trang lịch sử cá nhân
            </a>
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-4xl p-6 lg:p-8">
        <form className="mb-5 grid gap-3 rounded-3xl border border-(--line) bg-white/70 p-4 lg:grid-cols-[1fr_auto]">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Tìm theo username, tên học sinh hoặc tổ chức"
            className="rounded-2xl border border-(--line) bg-white px-4 py-2 text-sm outline-none focus:border-(--accent)"
          />
          <button
            type="submit"
            className="rounded-2xl bg-(--accent) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--accent-deep)"
          >
            Tra cứu
          </button>
        </form>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-(--line) bg-white/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
              Lượt nộp
            </div>
            <div className="mt-1 text-2xl font-semibold">{filteredRows.length}</div>
          </div>
          <div className="rounded-2xl border border-(--line) bg-white/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
              Học sinh
            </div>
            <div className="mt-1 text-2xl font-semibold">{uniqueStudents}</div>
          </div>
          <div className="rounded-2xl border border-(--line) bg-white/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
              Tổng số file
            </div>
            <div className="mt-1 text-2xl font-semibold">{totalFiles}</div>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="rounded-3xl border border-(--line) bg-white/65 px-6 py-10 text-center text-sm text-[rgba(31,26,23,0.68)]">
            Không có dữ liệu khớp điều kiện tra cứu.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-(--line) bg-white/70">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--line) bg-white/60 text-left">
                  <th className="px-4 py-3">Thời gian nộp</th>
                  <th className="px-4 py-3">Học sinh</th>
                  <th className="px-4 py-3">Tổ chức</th>
                  <th className="px-4 py-3 text-right">Số file</th>
                  <th className="px-4 py-3 text-right">Dung lượng</th>
                  <th className="px-4 py-3">Mã nộp</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-(--line) last:border-0">
                    <td className="px-4 py-3">{formatDateTime(row.savedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{row.displayName}</div>
                      <div className="text-xs text-[rgba(31,26,23,0.65)]">@{row.username}</div>
                    </td>
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