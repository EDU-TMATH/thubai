"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  username: string;
  password: string;
};

export function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Đăng nhập thất bại.");
        return;
      }

      router.push("/submit");
      router.refresh();
    } catch {
      setError("Không gọi được API đăng nhập. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-(--accent-deep)" htmlFor="username">
          Tài khoản
        </label>
        <input
          id="username"
          value={form.username}
          onChange={(event) =>
            setForm((current) => ({ ...current, username: event.target.value }))
          }
          className="w-full rounded-2xl border border-(--line) bg-white/80 px-4 py-3 outline-none transition focus:border-(--accent)"
          placeholder="Nhap username"
          autoComplete="username"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-(--accent-deep)" htmlFor="password">
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          value={form.password}
          onChange={(event) =>
            setForm((current) => ({ ...current, password: event.target.value }))
          }
          className="w-full rounded-2xl border border-(--line) bg-white/80 px-4 py-3 outline-none transition focus:border-(--accent)"
          placeholder="Nhap password"
          autoComplete="current-password"
        />
      </div>

      {error ? (
        <p className="rounded-2xl border border-[rgba(163,61,49,0.18)] bg-[rgba(163,61,49,0.08)] px-4 py-3 text-sm text-(--danger)">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-2xl bg-(--accent) px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-(--accent-deep) disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Đang đăng nhập..." : "Vào trang thu bài"}
      </button>
    </form>
  );
}