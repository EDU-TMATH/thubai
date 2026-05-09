import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { getSession } from "@/app/lib/auth";
import { fetchCurrentUser } from "@/app/lib/judge-api";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    const meResponse = await fetchCurrentUser(session);
    if (!("error" in meResponse)) {
      redirect("/submit");
    }
  }

  return (
    <main className="page-grid grid items-stretch gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="glass-panel relative overflow-hidden rounded-4xl px-8 py-10 lg:px-12 lg:py-14">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,rgba(66,165,230,0.2),transparent_72%)] lg:block" />
        <div className="relative flex h-full flex-col justify-between gap-10">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-(--line) bg-white/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-(--accent-deep)">
              Hệ thống thu bài
            </div>
            <div className="max-w-2xl space-y-4">
              <h1 className="text-4xl font-semibold leading-tight text-foreground lg:text-6xl">
                Nộp bài thi nhanh chóng, an toàn và đúng hạn.
              </h1>
              <p className="max-w-xl text-base leading-8 text-[rgba(31,26,23,0.72)] lg:text-lg">
                Đăng nhập bằng tài khoản học sinh, chọn lớp và tải lên bài làm của bạn. Hệ thống sẽ lưu trữ và xác nhận ngay lập tức.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-(--line) bg-white/65 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--accent-deep)">
                Bước 1
              </p>
              <h2 className="mt-3 text-lg font-semibold">Đăng nhập tài khoản</h2>
              <p className="mt-2 text-sm leading-6 text-[rgba(31,26,23,0.72)]">
                Sử dụng tài khoản được cấp để đăng nhập vào hệ thống.
              </p>
            </article>
            <article className="rounded-3xl border border-(--line) bg-white/65 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--accent-deep)">
                Bước 2
              </p>
              <h2 className="mt-3 text-lg font-semibold">Tải lên bài làm</h2>
              <p className="mt-2 text-sm leading-6 text-[rgba(31,26,23,0.72)]">
                Chọn và tải lên các file bài làm. Hệ thống hỗ trợ .cpp, .py và .pas.
              </p>
            </article>
            <article className="rounded-3xl border border-(--line) bg-white/65 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--accent-deep)">
                Bước 3
              </p>
              <h2 className="mt-3 text-lg font-semibold">Xác nhận nộp bài</h2>
              <p className="mt-2 text-sm leading-6 text-[rgba(31,26,23,0.72)]">
                Hệ thống xác nhận và lưu trữ bài nộp theo lớp học của bạn.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="glass-panel flex items-center rounded-4xl px-6 py-8 lg:px-8">
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-(--accent-deep)">
              Đăng nhập
            </p>
            <h2 className="text-3xl font-semibold leading-tight">Truy cập trang thu bài</h2>
            <p className="text-sm leading-7 text-[rgba(31,26,23,0.72)]">
              Nhập tài khoản và mật khẩu được cấp để vào hệ thống. Nếu chưa có tài khoản, vui lòng liên hệ giáo viên phụ trách.
            </p>
          </div>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}