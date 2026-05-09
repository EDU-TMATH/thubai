import { redirect } from "next/navigation";

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
      <section className="glass-panel rounded-4xl px-8 py-10 lg:px-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-(--accent-deep)">
              Quản trị hệ thống
            </p>
            <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
              Bảng điều khiển
            </h1>
            <p className="text-base leading-8 ext-[rgba(31,26,23,0.74)]">
              Cấu hình thời gian thu bài, theo dõi thống kê và quản lý bài nộp của học sinh.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-[14px] bg-(--accent-soft) px-3 py-1.5 text-xs font-semibold text-(--accent-deep)">
              {user.username}
            </span>
            <a
              href="/admin/history"
              className="rounded-[14px] bg-(--accent) px-4 py-2 text-sm font-semibold text-white transition hover:bg-(--accent-deep)"
            >
              Lịch sử toàn hệ thống
            </a>
            <a
              href="/submit"
              className="rounded-[14px] border border-(--line) bg-white/70 px-4 py-2 text-sm font-semibold text-[rgba(31,26,23,0.8)] transition hover:bg-white"
            >
              ← Trang thu bài
            </a>
          </div>
        </div>
      </section>

      <AdminPanel initialSettings={settings} />
    </main>
  );
}
