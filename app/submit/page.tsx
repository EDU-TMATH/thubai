import { redirect } from "next/navigation";
import { ClockIcon, GaugeIcon, GearIcon, UploadSimpleIcon } from "@phosphor-icons/react/ssr";

import { PageHeader } from "@/app/components/page-header";
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
      <PageHeader
        size="wide"
        eyebrow={
          <>
            <UploadSimpleIcon size={20} weight="duotone" aria-hidden="true" />
            Hệ thống thu bài
          </>
        }
        title="Nộp bài thi trực tuyến"
        description="Đăng nhập bằng tài khoản hệ thống, chọn tổ chức thi và tải lên bài làm. Mỗi lần nộp được lưu riêng theo tổ chức và tài khoản để quản lý dễ dàng."
        summary={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl border border-(--line) bg-white/65 p-3.5">
              <GaugeIcon className="shrink-0 text-(--accent)" size={26} weight="duotone" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">Giới hạn</p>
                <p className="mt-1 text-lg font-semibold">{formatKilobytes(MAX_TOTAL_UPLOAD_SIZE)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-(--line) bg-white/65 p-3.5">
              <ClockIcon className="shrink-0 text-(--accent)" size={26} weight="duotone" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">Thời gian</p>
                <p className={`mt-1 text-sm font-semibold leading-snug ${windowColor}`}>{windowLabel}</p>
              </div>
            </div>
          </div>
        }
        actions={
          <>
            {currentUser.is_superuser && (
              <a
                href="/admin"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-(--line) bg-white/70 px-4 py-2.5 text-sm font-semibold text-(--accent-deep) transition hover:bg-white"
              >
                <GearIcon size={19} weight="duotone" aria-hidden="true" />
                Trang quản trị
              </a>
            )}
            <a
              href="/history"
              className="inline-flex items-center justify-center rounded-2xl bg-(--accent) px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-(--accent-deep)"
            >
              Xem lịch sử nộp bài
            </a>
          </>
        }
      />

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
