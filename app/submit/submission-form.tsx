"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function getFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function SubmissionForm({ username, displayName, organizations }: SubmissionFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [organizationId, setOrganizationId] = useState<string>("");
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

  useEffect(() => {
    if (!status.text || status.tone === "idle") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStatus((currentStatus) =>
        currentStatus.text
          ? { tone: "idle", text: "" }
          : currentStatus,
      );
    }, 4200);

    return () => window.clearTimeout(timeoutId);
  }, [status]);

  function updateFiles(nextFiles: FileList | null) {
    if (!nextFiles) {
      return;
    }

    const incomingFiles = Array.from(nextFiles);
    setFiles((currentFiles) => {
      const mergedFiles = [...currentFiles];
      const seen = new Set(currentFiles.map(getFileKey));

      for (const file of incomingFiles) {
        const fileKey = getFileKey(file);
        if (seen.has(fileKey)) {
          continue;
        }

        seen.add(fileKey);
        mergedFiles.push(file);
      }

      return mergedFiles;
    });
    setStatus({ tone: "idle", text: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeFile(fileToRemove: File) {
    setFiles((currentFiles) =>
      currentFiles.filter((file) => getFileKey(file) !== getFileKey(fileToRemove)),
    );
    setStatus({ tone: "idle", text: "" });
  }

  function clearFiles() {
    setFiles([]);
    setStatus({ tone: "idle", text: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
      {status.text && status.tone !== "idle" ? (
        <div className="pointer-events-none fixed right-5 top-5 z-50 w-[min(92vw,420px)]">
          <div
            className={`pointer-events-auto rounded-[24px] border px-5 py-4 shadow-[0_20px_60px_rgba(16,90,145,0.2)] backdrop-blur-xl ${
              status.tone === "success"
                ? "border-[rgba(33,92,71,0.18)] bg-[rgba(238,252,247,0.96)] text-(--success)"
                : "border-[rgba(163,61,49,0.18)] bg-[rgba(255,244,242,0.97)] text-(--danger)"
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                  {status.tone === "success" ? "Nộp bài thành công" : "Không thể nộp bài"}
                </p>
                <p className="mt-2 text-sm font-medium leading-6 text-[rgba(18,48,71,0.88)]">
                  {status.text}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatus({ tone: "idle", text: "" })}
                className="rounded-full border border-black/8 px-3 py-1 text-xs font-semibold text-[rgba(18,48,71,0.7)] transition hover:bg-white/70"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              <option value="">
                {organizations.length === 0
                  ? "Bạn chưa vào tổ chức nào"
                  : "Chọn tổ chức để nộp bài"}
              </option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.short_name} - {organization.name}
                </option>
              ))}
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
          <div className="mt-4 rounded-3xl border border-amber-300 bg-amber-100/90 px-5 py-4 text-amber-900 shadow-[0_12px_30px_rgba(180,120,20,0.12)]">
            <p className="text-sm font-bold uppercase tracking-[0.18em]">
              Lưu ý quan trọng
            </p>
            <p className="mt-2 text-base font-semibold leading-7">
              Nếu bài có nhiều tệp, hãy chọn tiếp nhiều lần để thêm đủ tất cả tệp trước khi bấm nộp.
            </p>
            <p className="mt-2 text-sm leading-7 text-[rgba(92,53,12,0.86)]">
              Hệ thống sẽ cộng dồn các lần chọn file. Chấp nhận {acceptedExtensions.join(", ")} và tổng dung lượng không quá {formatBytes(maxTotalBytes)}.
            </p>
          </div>
          <div className="mt-6 rounded-[28px] border-2 border-dashed border-(--accent) bg-[rgba(47,157,224,0.08)] p-5 text-center shadow-[inset_0_0_0_1px_rgba(47,157,224,0.08)]">
            <span className="inline-flex rounded-full bg-(--accent) px-5 py-2 text-sm font-bold text-white shadow-sm">
              Bấm vào đây để chọn tệp
            </span>
            <p className="mt-3 text-base font-semibold text-(--accent-deep)">
              Chọn lại nhiều lần nếu cần thêm tệp khác.
            </p>
            <p className="mt-2 text-sm leading-7 text-[rgba(31,26,23,0.72)]">
              Có thể chọn 1 tệp trước, rồi bấm lại vào chính vùng này để thêm các tệp còn thiếu.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="mt-4 block w-full cursor-pointer text-sm file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:font-semibold file:text-(--accent-deep)"
              multiple
              accept={acceptedExtensions.join(",")}
              onChange={(event) => updateFiles(event.target.files)}
            />
          </div>
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
            {files.length > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={clearFiles}
                  className="rounded-full border border-(--line) px-3 py-1 text-xs font-semibold text-(--accent-deep) transition hover:bg-white/70"
                >
                  Xóa tất cả
                </button>
              </div>
            )}

            <div className="mt-4 space-y-3">
              {files.length === 0 ? (
                <p className="rounded-2xl border border-(--line) bg-[rgba(255,255,255,0.58)] px-4 py-3 text-sm text-[rgba(31,26,23,0.68)]">
                  Chưa có tệp nào được chọn.
                </p>
              ) : (
                files.map((file) => (
                  <div
                    key={getFileKey(file)}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-(--line) bg-white/70 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{file.name}</p>
                      <p className="text-xs text-[rgba(31,26,23,0.68)]">{file.type || "tệp mã nguồn"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs font-semibold text-(--accent-deep)">
                        {formatBytes(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(file)}
                        className="rounded-full border border-(--line) px-3 py-1 text-xs font-semibold text-[rgba(31,26,23,0.74)] transition hover:bg-white"
                      >
                        Xóa
                      </button>
                    </div>
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
            {files.length === 1 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold leading-6 text-amber-900">
                Bạn mới chọn 1 tệp. Nếu bài có nhiều tệp, hãy bấm chọn file thêm lần nữa trước khi nộp.
              </div>
            )}
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
    </div>
  );
}
