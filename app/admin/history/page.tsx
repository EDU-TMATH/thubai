import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ClockCounterClockwiseIcon,
  DownloadSimpleIcon,
  FilesIcon,
  MagnifyingGlassIcon,
  UsersIcon,
} from "@phosphor-icons/react/ssr";

import { PageHeader } from "@/app/components/page-header";
import { getSession } from "@/app/lib/auth";
import { fetchCurrentUser } from "@/app/lib/judge-api";
import { getSubmissionHistoryPage } from "@/app/lib/submission-history-db";

type AdminHistoryPageProps = {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
};

const PAGE_SIZE = 25;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

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
  const keyword = firstParam(params.q).trim();
  const requestedPage = Number.parseInt(firstParam(params.page), 10) || 1;
  const history = await getSubmissionHistoryPage(requestedPage, PAGE_SIZE, keyword);
  const { rows, page, totalPages, totalCount, uniqueStudents, totalFiles } = history;

  function pageHref(targetPage: number) {
    return {
      pathname: "/admin/history",
      query: {
        ...(keyword ? { q: keyword } : {}),
        page: targetPage,
      },
    };
  }

  return (
    <main className="page-grid mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        eyebrow={
          <>
            <ClockCounterClockwiseIcon size={20} weight="duotone" aria-hidden="true" />
            Quản trị tra cứu lịch sử
          </>
        }
        title="Toàn bộ lịch sử nộp bài"
        description="Quản trị viên có thể tra cứu theo học sinh hoặc tổ chức."
        actions={
          <>
            <a
              href="/admin"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-(--line) bg-white/70 px-4 py-2.5 text-sm font-semibold text-(--accent-deep) transition hover:bg-white"
            >
              <ArrowLeftIcon size={18} weight="bold" aria-hidden="true" />
              Quay lại quản trị
            </a>
            <a
              href="/api/admin/history/download"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-(--accent) px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-(--accent-deep)"
            >
              <DownloadSimpleIcon size={18} weight="bold" aria-hidden="true" />
              Tải xuống theo tổ chức
            </a>
            <a
              href={`/api/admin/history/export${keyword ? `?q=${encodeURIComponent(keyword)}` : ""}`}
              className="inline-flex items-center justify-center rounded-2xl border border-(--line) bg-white/70 px-4 py-2.5 text-sm font-semibold text-(--accent-deep) transition hover:bg-white"
            >
              Xuất CSV
            </a>
            <a
              href="/history"
              className="inline-flex items-center justify-center rounded-2xl border border-(--line) bg-white/70 px-4 py-2.5 text-sm font-semibold text-(--accent-deep) transition hover:bg-white"
            >
              Trang lịch sử cá nhân
            </a>
          </>
        }
      />

      <section className="glass-panel rounded-4xl p-6 lg:p-8">
        <form className="mb-5 grid gap-3 rounded-3xl border border-(--line) bg-white/70 p-4 lg:grid-cols-[1fr_auto]">
          <input
            name="q"
            defaultValue={keyword}
            placeholder="Tìm theo username, tên học sinh hoặc tổ chức"
            className="rounded-2xl border border-(--line) bg-white px-4 py-2 text-sm outline-none focus:border-(--accent)"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-(--accent) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--accent-deep)"
          >
            <MagnifyingGlassIcon size={18} weight="bold" aria-hidden="true" />
            Tra cứu
          </button>
        </form>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-(--line) bg-white/70 p-4">
            <ClockCounterClockwiseIcon className="mb-2 text-(--accent)" size={24} weight="duotone" aria-hidden="true" />
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
              Lượt nộp
            </div>
            <div className="mt-1 text-2xl font-semibold">{totalCount}</div>
          </div>
          <div className="rounded-2xl border border-(--line) bg-white/70 p-4">
            <UsersIcon className="mb-2 text-(--accent)" size={24} weight="duotone" aria-hidden="true" />
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
              Học sinh
            </div>
            <div className="mt-1 text-2xl font-semibold">{uniqueStudents}</div>
          </div>
          <div className="rounded-2xl border border-(--line) bg-white/70 p-4">
            <FilesIcon className="mb-2 text-(--accent)" size={24} weight="duotone" aria-hidden="true" />
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
              Tổng số file
            </div>
            <div className="mt-1 text-2xl font-semibold">{totalFiles}</div>
          </div>
        </div>

        {rows.length === 0 ? (
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
                {rows.map((row) => (
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

        {totalCount > 0 && (
          <nav
            aria-label="Phân trang lịch sử nộp bài"
            className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row"
          >
            <p className="text-sm text-[rgba(31,26,23,0.68)]">
              Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} trong {totalCount} lượt nộp
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="rounded-xl border border-(--line) bg-white/70 px-4 py-2 text-sm font-semibold text-(--accent-deep) transition hover:bg-white"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ArrowLeftIcon size={16} weight="bold" aria-hidden="true" />
                    Trang trước
                  </span>
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-xl border border-(--line) bg-white/40 px-4 py-2 text-sm font-semibold text-[rgba(31,26,23,0.35)]">
                  ← Trang trước
                </span>
              )}
              <span className="px-2 text-sm font-semibold">
                Trang {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  className="rounded-xl border border-(--line) bg-white/70 px-4 py-2 text-sm font-semibold text-(--accent-deep) transition hover:bg-white"
                >
                  <span className="inline-flex items-center gap-1.5">
                    Trang sau
                    <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
                  </span>
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-xl border border-(--line) bg-white/40 px-4 py-2 text-sm font-semibold text-[rgba(31,26,23,0.35)]">
                  Trang sau →
                </span>
              )}
            </div>
          </nav>
        )}
      </section>
    </main>
  );
}
