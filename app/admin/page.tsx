import { redirect } from "next/navigation";
import {
  ArrowLeftIcon,
  ClockCounterClockwiseIcon,
  GearIcon,
} from "@phosphor-icons/react/ssr";

import { PageHeader } from "@/app/components/page-header";
import { getSession } from "@/app/lib/auth";
import { fetchCurrentUser } from "@/app/lib/judge-api";
import { loadSettings } from "@/app/lib/settings";
import AdminPanel from "@/app/admin/admin-panel";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const meResult = await fetchCurrentUser(session);
  if ("error" in meResult) redirect("/login");

  const user = meResult.data;
  if (!user.is_superuser) redirect("/submit");

  const settings = await loadSettings();

  return (
    <main className="page-grid mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        eyebrow={
          <>
            <GearIcon size={20} weight="duotone" aria-hidden="true" />
            Quản trị hệ thống
          </>
        }
        title="Bảng điều khiển"
        description={
          <>
            Cấu hình thời gian thu bài, theo dõi thống kê và quản lý bài nộp của học sinh.{" "}
            <span className="font-semibold">@{user.username}</span>
          </>
        }
        actions={
          <>
            <a
              href="/admin/history"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-(--accent) px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-(--accent-deep)"
            >
              <ClockCounterClockwiseIcon size={18} weight="bold" aria-hidden="true" />
              Lịch sử toàn hệ thống
            </a>
            <a
              href="/submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-(--line) bg-white/70 px-4 py-2.5 text-sm font-semibold text-[rgba(31,26,23,0.8)] transition hover:bg-white"
            >
              <ArrowLeftIcon size={18} weight="bold" aria-hidden="true" />
              Trang thu bài
            </a>
          </>
        }
      />

      <AdminPanel initialSettings={settings} />
    </main>
  );
}
