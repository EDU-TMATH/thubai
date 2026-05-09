"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type OrganizationOption = {
  id: number;
  name: string;
  short_name: string;
};

const acceptedExtensions = [".cpp", ".py", ".pas"];
const maxTotalBytes = 1024 * 1024;

type SubmissionFormProps = {
  username: string;
  displayName: string;
  organizations: OrganizationOption[];
};

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function SubmissionForm({ username, displayName, organizations }: SubmissionFormProps) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [organizationId, setOrganizationId] = useState<string>(
    organizations[0] ? String(organizations[0].id) : "",
  );
  const [status, setStatus] = useState<{ tone: "idle" | "error" | "success"; text: string }>({
    tone: "idle",
    text: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const totalBytes = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files],
  );
  const selectedOrganization = useMemo(
    () => organizations.find((organization) => String(organization.id) === organizationId) ?? null,
    [organizationId, organizations],
  );

  function updateFiles(nextFiles: FileList | null) {
    if (!nextFiles) {
      setFiles([]);
      return;
    }

    const fileList = Array.from(nextFiles);
    setFiles(fileList);
    setStatus({ tone: "idle", text: "" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;

    if (files.length === 0) {
      setStatus({ tone: "error", text: "Vui lòng chọn ít nhất một file bài làm." });
      return;
    }

    if (!organizationId) {
      setStatus({ tone: "error", text: "Vui lòng chọn tổ chức trước khi nộp bài." });
      return;
    }

    setIsSubmitting(true);
    setStatus({ tone: "idle", text: "" });

    try {
      let responseOk = false;
      let result: { error?: string; message?: string } = {};

      try {
        const formData = new FormData();
        formData.append("organizationId", organizationId);
        files.forEach((file) => formData.append("files", file));

        const response = await fetch("/api/submissions", {
          method: "POST",
          body: formData,
        });

        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          result = (await response.json()) as { error?: string; message?: string };
        } else {
          const fallbackText = await response.text();
          if (fallbackText.trim()) {
            result = { error: fallbackText };
          }
        }

        responseOk = response.ok;
      } catch {
        setStatus({ tone: "error", text: "Không gọi được API nộp bài. Vui lòng thử lại." });
        return;
      }

      if (!responseOk) {
        setStatus({ tone: "error", text: result.error ?? "Nộp bài thất bại." });
        return;
      }

      setStatus({
        tone: "success",
        text: result.message ?? "Nộp bài thành công.",
      });
      setFiles([]);
      formElement.reset();
      try {
        router.refresh();
      } catch {
        // Ignore refresh failures after a successful submission.
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-(--line) bg-white/65 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--accent-deep)">
            Phiên đăng nhập
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{displayName}</h2>
          <p className="mt-1 text-sm text-[rgba(31,26,23,0.72)]">@{username}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="rounded-full border border-(--line) px-4 py-2 text-sm font-semibold text-(--accent-deep) transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
        </button>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="rounded-[28px] border border-(--line) bg-white/70 p-5">
          <label className="space-y-3">
            <span className="block text-sm font-semibold uppercase tracking-[0.2em] text-(--accent-deep)">
              Tổ chức nộp bài
            </span>
            <span className="block text-sm leading-7 text-[rgba(31,26,23,0.72)]">
              Chọn tổ chức bạn muốn nộp bài.
            </span>
            <select
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className="w-full rounded-2xl border border-(--line) bg-white px-4 py-3 outline-none transition focus:border-(--accent)"
            >
              {organizations.length === 0 ? (
                <option value="">Bạn chưa vào tổ chức nào</option>
              ) : (
                organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.short_name} - {organization.name}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        <label className="block rounded-[28px] border border-dashed border-(--accent) bg-white/70 p-6 transition hover:bg-white/80">
          <span className="block text-sm font-semibold uppercase tracking-[0.2em] text-(--accent-deep)">
            Tải tệp bài làm
          </span>
          <span className="mt-3 block text-2xl font-semibold leading-tight">
            Chọn một hoặc nhiều tệp mã nguồn.
          </span>
          <span className="mt-3 block text-sm leading-7 text-[rgba(31,26,23,0.72)]">
            Chấp nhận {acceptedExtensions.join(", ")} và tổng dung lượng không quá {formatBytes(maxTotalBytes)}.
          </span>
          <input
            type="file"
            className="mt-6 block w-full text-sm"
            multiple
            accept={acceptedExtensions.join(",")}
            onChange={(event) => updateFiles(event.target.files)}
          />
        </label>

        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <div className="rounded-[28px] border border-(--line) bg-white/65 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-(--accent-deep)">Danh sách tệp</p>
                <p className="text-sm text-[rgba(31,26,23,0.68)]">
                  {files.length} tệp, {formatBytes(totalBytes)}
                </p>
              </div>
              <div className="rounded-full bg-[rgba(47,157,224,0.14)] px-3 py-1 text-xs font-semibold text-(--accent-deep)">
                Giới hạn 1 MB
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {files.length === 0 ? (
                <p className="rounded-2xl border border-(--line) bg-[rgba(255,255,255,0.58)] px-4 py-3 text-sm text-[rgba(31,26,23,0.68)]">
                  Chưa có tệp nào được chọn.
                </p>
              ) : (
                files.map((file) => (
                  <div
                    key={`${file.name}-${file.lastModified}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-(--line) bg-white/70 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{file.name}</p>
                      <p className="text-xs text-[rgba(31,26,23,0.68)]">{file.type || "tệp mã nguồn"}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-(--accent-deep)">
                      {formatBytes(file.size)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <aside className="rounded-[28px] border border-(--line) bg-[rgba(20,122,82,0.92)] p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(227,255,241,0.86)]">
              Thông tin nộp bài
            </p>
            <p className="mt-3 text-sm leading-7 text-[rgba(236,255,246,0.9)]">
              Bài nộp được lưu theo tổ chức đã chọn và tài khoản đăng nhập để đối soát.
            </p>
            <p
              className={`mt-3 text-xs leading-6 ${selectedOrganization
                  ? "text-[rgba(220,255,236,0.84)]"
                  : "rounded-md bg-[rgba(255,228,228,0.26)] px-2 py-1 font-semibold text-[rgba(255,188,188,0.98)]"
                }`}
            >
              {selectedOrganization
                ? `Đích lưu hiện tại: ${selectedOrganization.short_name}`
                : "Bạn chưa vào tổ chức nào."}
            </p>
            <button
              type="submit"
              disabled={isSubmitting || organizations.length === 0}
              className="mt-6 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-(--accent-deep) transition hover:bg-(--accent-soft) disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Đang gửi bài..." : "Nộp bài"}
            </button>
          </aside>
        </div>
      </form>

      {status.text ? (
        <p
          className={
            status.tone === "success"
              ? "rounded-2xl border border-[rgba(33,92,71,0.2)] bg-[rgba(33,92,71,0.1)] px-4 py-3 text-sm text-(--success)"
              : status.tone === "error"
                ? "rounded-2xl border border-[rgba(163,61,49,0.18)] bg-[rgba(163,61,49,0.08)] px-4 py-3 text-sm text-(--danger)"
                : "hidden"
          }
        >
          {status.text}
        </p>
      ) : null}
    </div>
  );
}