import { redirect } from "next/navigation";

import { getSession } from "@/app/lib/auth";
import { extractOrganizations, fetchCurrentUser } from "@/app/lib/judge-api";
import { getWindowStatus, loadSettings } from "@/app/lib/settings";
import { MAX_TOTAL_UPLOAD_SIZE } from "@/app/lib/submissions";
import { SubmissionForm } from "@/app/submit/submission-form";

function formatKilobytes(value: number) {
  return `${Math.round(value / 1024)} KB`;
}

function formatDate(date: Date) {
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}


export default async function SubmitPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const meResponse = await fetchCurrentUser(session);
  if ("error" in meResponse) {
    redirect("/login");
  }

  const currentUser = meResponse.data;
  const organizations = extractOrganizations(currentUser);
  const settings = await loadSettings();
  const { status, start, end } = getWindowStatus(settings);

  const windowLabel =
    status === "unconfigured"
      ? "Luôn mở"
      : status === "open"
        ? `Đang mở — Kết thúc ${formatDate(end!)}`
        : status === "pending"
          ? `Chưa đến giờ — Bắt đầu ${formatDate(start!)}`
          : `Đã đóng — Kết thúc ${formatDate(end!)}`;

  const windowColor =
    status === "open" || status === "unconfigured"
      ? "text-emerald-700"
      : status === "pending"
        ? "text-amber-700"
        : "text-red-700";

  return (
    <main className="page-grid mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="glass-panel rounded-4xl px-8 py-10 lg:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-(--accent-deep)">
              Hệ thống thu bài
            </p>
            <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
              Nộp bài thi trực tuyến
            </h1>
            <p className="text-base leading-8 text-[rgba(31,26,23,0.74)]">
              Đăng nhập bằng tài khoản hệ thống, chọn tổ chức thi và tải lên bài làm. Mỗi lần nộp được lưu riêng theo tổ chức và tài khoản để quản lý dễ dàng.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
            <div className="rounded-3xl border border-(--line) bg-white/65 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--accent-deep)">
                Giới hạn
              </p>
              <p className="mt-2 text-2xl font-semibold">{formatKilobytes(MAX_TOTAL_UPLOAD_SIZE)}</p>
              <p className="mt-2 text-sm text-[rgba(31,26,23,0.68)]">Tổng dung lượng mỗi lần nộp.</p>
            </div>
            <div className="rounded-3xl border border-(--line) bg-white/65 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--accent-deep)">
                Thời gian
              </p>
              <p className={`mt-2 text-sm font-semibold leading-snug ${windowColor}`}>{windowLabel}</p>
              <p className="mt-2 text-sm text-[rgba(31,26,23,0.68)]">Tổ chức: {organizations.length}</p>
            </div>
            {currentUser.is_superuser && (
              <a
                href="/admin"
                className="col-span-full rounded-3xl border border-(--accent-soft) bg-(--accent-soft) px-4 py-3 text-center text-sm font-semibold text-(--accent-deep) transition hover:bg-(--accent) hover:text-white"
              >
                Vào trang quản trị →
              </a>
            )}
            <a
              href="/history"
              className="col-span-full rounded-3xl border border-(--line) bg-white/75 px-4 py-3 text-center text-sm font-semibold text-(--accent-deep) transition hover:bg-white"
            >
              Xem lịch sử nộp bài
            </a>
          </div>
        </div>
      </section>

      {status === "closed" && (
        <div className="rounded-[20px] border border-red-200 bg-red-50 px-6 py-4 text-sm font-medium text-red-700">
          Thời gian nộp bài đã kết thúc. Hệ thống hiện không nhận bài mới.
        </div>
      )}
      {status === "pending" && (
        <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-6 py-4 text-sm font-medium text-amber-700">
          Chưa đến thời gian thu bài. Hệ thống sẽ mở lúc {formatDate(start!)}.
        </div>
      )}

      <section className="glass-panel rounded-4xl px-6 py-6 lg:px-8 lg:py-8">
        <SubmissionForm
          username={currentUser.username}
          displayName={currentUser.display_name}
          organizations={organizations}
        />
      </section>
    </main>
  );
}