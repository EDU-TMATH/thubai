"use client";

import { useCallback, useEffect, useState } from "react";

type AppSettings = {
  submissionStart: string | null;
  submissionEnd: string | null;
  storagePrefix: string;
};

type SubmissionRecord = {
  submissionId: string;
  org: string;
  username: string;
  displayName: string;
  organizationName: string;
  savedAt: string;
  fileCount: number;
  totalBytes: number;
};

type UserStat = {
  org: string;
  organizationName: string;
  username: string;
  displayName: string;
  count: number;
  lastAt: string;
};

type Tab = "settings" | "stats" | "submissions";

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function getClientWindowStatus(start: string, end: string): string {
  if (!start || !end) return "unconfigured";
  const now = new Date();
  const s = new Date(start);
  const e = new Date(end);
  if (now < s) return "pending";
  if (now > e) return "closed";
  return "open";
}

function aggregateStats(submissions: SubmissionRecord[]): UserStat[] {
  const map = new Map<string, UserStat>();
  for (const s of submissions) {
    const key = `${s.org}::${s.username}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      if (s.savedAt > existing.lastAt) existing.lastAt = s.savedAt;
    } else {
      map.set(key, {
        org: s.org,
        organizationName: s.organizationName,
        username: s.username,
        displayName: s.displayName,
        count: 1,
        lastAt: s.savedAt,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

const TABS: { id: Tab; label: string }[] = [
  { id: "settings", label: "Cài đặt" },
  { id: "stats", label: "Thống kê" },
  { id: "submissions", label: "Bài nộp" },
];

export default function AdminPanel({ initialSettings }: { initialSettings: AppSettings }) {
  const [tab, setTab] = useState<Tab>("settings");

  // Settings form state
  const [startInput, setStartInput] = useState(toDatetimeLocal(initialSettings.submissionStart));
  const [endInput, setEndInput] = useState(toDatetimeLocal(initialSettings.submissionEnd));
  const [prefixInput, setPrefixInput] = useState(initialSettings.storagePrefix);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Stats state
  const [submissions, setSubmissions] = useState<SubmissionRecord[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (res.status === 403) {
          window.location.href = "/submit";
          return;
        }
        throw new Error(data?.error ?? `Lỗi ${res.status}`);
      }
      const data = (await res.json()) as { submissions: SubmissionRecord[] };
      setSubmissions(data.submissions);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Lỗi tải dữ liệu.");
      setSubmissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "settings" && submissions === null) {
      void fetchStats();
    }
  }, [tab, submissions, fetchStats]);

  async function handleSaveSettings() {
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const body: AppSettings = {
        submissionStart: fromDatetimeLocal(startInput),
        submissionEnd: fromDatetimeLocal(endInput),
        storagePrefix: prefixInput.trim() || "/tmp",
      };
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaveMsg({ ok: true, text: "Đã lưu cài đặt." });
      } else {
        const data = (await res.json()) as { error?: string };
        setSaveMsg({ ok: false, text: data.error ?? "Lỗi lưu cài đặt." });
      }
    } catch {
      setSaveMsg({ ok: false, text: "Không thể kết nối máy chủ." });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  }

  async function handleDeleteOne(rec: SubmissionRecord) {
    if (!confirm(`Xóa bài nộp của ${rec.displayName} (${rec.submissionId.slice(-8)})?`)) return;
    await fetch("/api/admin/submissions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org: rec.org, username: rec.username, submissionId: rec.submissionId }),
    });
    void fetchStats();
  }

  async function handleDeleteAll() {
    if (!confirm("Xóa TẤT CẢ bài nộp? Thao tác này không thể hoàn tác.")) return;
    const res = await fetch("/api/admin/submissions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setLoadError(data?.error ?? "Xóa tất cả bài nộp thất bại.");
      return;
    }
    setLoadError(null);
    void fetchStats();
  }

  const userStats = aggregateStats(submissions ?? []);
  const totalCount = submissions?.length ?? 0;
  const uniqueUsers = userStats.length;
  const uniqueOrgs = new Set(userStats.map((s) => s.org)).size;

  const windowStatus = getClientWindowStatus(startInput, endInput);
  const windowStatusLabel =
    windowStatus === "unconfigured"
      ? "Chưa cấu hình — luôn mở"
      : windowStatus === "open"
        ? "Đang mở"
        : windowStatus === "pending"
          ? "Chưa đến giờ"
          : "Đã đóng";
  const windowStatusColor =
    windowStatus === "open"
      ? "bg-emerald-100 text-emerald-700"
      : windowStatus === "pending"
        ? "bg-amber-100 text-amber-700"
        : windowStatus === "closed"
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-500";

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-2 rounded-2xl bg-white/50 p-1.5">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-[14px] py-2 text-sm font-semibold transition ${
              tab === id
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[color:rgba(31,26,23,0.6)] hover:bg-white/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ───── Settings Tab ───── */}
      {tab === "settings" && (
        <div className="space-y-5">
          {/* Time window card */}
          <div className="rounded-[20px] border border-[var(--line)] bg-white/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-deep)]">
                Thời gian thu bài
              </h3>
              <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${windowStatusColor}`}>
                {windowStatusLabel}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-xs font-medium text-[color:rgba(31,26,23,0.6)]">
                  Bắt đầu
                </span>
                <input
                  type="datetime-local"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  className="w-full rounded-[14px] border border-[var(--line)] bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-medium text-[color:rgba(31,26,23,0.6)]">
                  Kết thúc
                </span>
                <input
                  type="datetime-local"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  className="w-full rounded-[14px] border border-[var(--line)] bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-[color:rgba(31,26,23,0.5)]">
              Để trống cả hai ô để mở thu bài không giới hạn thời gian.
            </p>
          </div>

          {/* Storage prefix card */}
          <div className="rounded-[20px] border border-[var(--line)] bg-white/60 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-deep)]">
              Thư mục lưu bài
            </h3>
            <label className="space-y-1.5">
              <span className="block text-xs font-medium text-[color:rgba(31,26,23,0.6)]">
                Đường dẫn thư mục gốc
              </span>
              <input
                type="text"
                value={prefixInput}
                onChange={(e) => setPrefixInput(e.target.value)}
                placeholder="/tmp"
                className="w-full rounded-[14px] border border-[var(--line)] bg-white/80 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              />
            </label>
            <p className="mt-3 text-xs text-[color:rgba(31,26,23,0.5)]">
              Bài nộp sẽ được lưu vào <code className="font-mono">{prefixInput || "/tmp"}
              /&lt;tổ-chức&gt;/&lt;tài-khoản&gt;/&lt;id&gt;/</code>
            </p>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => void handleSaveSettings()}
              disabled={isSaving}
              className="rounded-[16px] bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-deep)] disabled:opacity-50"
            >
              {isSaving ? "Đang lưu…" : "Lưu cài đặt"}
            </button>
            {saveMsg && (
              <p className={`text-sm font-medium ${saveMsg.ok ? "text-emerald-700" : "text-red-600"}`}>
                {saveMsg.text}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ───── Stats Tab ───── */}
      {tab === "stats" && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Lượt nộp", value: totalCount },
              { label: "Học sinh", value: uniqueUsers },
              { label: "Tổ chức", value: uniqueOrgs },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-[20px] border border-[var(--line)] bg-white/60 p-4 text-center"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-deep)]">
                  {label}
                </p>
                <p className="mt-2 text-3xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-deep)]">
              Chi tiết theo học sinh
            </h3>
            <button
              onClick={() => void fetchStats()}
              disabled={isLoading}
              className="rounded-[12px] border border-[var(--line)] bg-white/70 px-3 py-1.5 text-xs font-medium transition hover:bg-white disabled:opacity-50"
            >
              {isLoading ? "Đang tải…" : "Làm mới"}
            </button>
          </div>

          {loadError && (
            <p className="text-sm text-red-600">{loadError}</p>
          )}

          {isLoading && !submissions && (
            <p className="text-sm text-[color:rgba(31,26,23,0.5)]">Đang tải dữ liệu…</p>
          )}

          {submissions !== null && userStats.length === 0 && (
            <p className="rounded-[16px] border border-[var(--line)] bg-white/50 px-5 py-8 text-center text-sm text-[color:rgba(31,26,23,0.5)]">
              Chưa có bài nộp nào.
            </p>
          )}

          {userStats.length > 0 && (
            <div className="overflow-x-auto rounded-[20px] border border-[var(--line)] bg-white/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-deep)]">
                      Tổ chức
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-deep)]">
                      Học sinh
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-deep)]">
                      Lần nộp
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-deep)]">
                      Nộp lần cuối
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {userStats.map((stat) => (
                    <tr
                      key={`${stat.org}-${stat.username}`}
                      className="border-b border-[var(--line)] last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{stat.organizationName}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{stat.displayName}</span>
                        <span className="ml-2 text-xs text-[color:rgba(31,26,23,0.5)]">
                          @{stat.username}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[var(--accent-deep)]">
                        {stat.count}
                      </td>
                      <td className="px-4 py-3 text-[color:rgba(31,26,23,0.65)]">
                        {formatDateTime(stat.lastAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───── Submissions Tab ───── */}
      {tab === "submissions" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-deep)]">
              Tất cả bài nộp ({totalCount})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => void fetchStats()}
                disabled={isLoading}
                className="rounded-[12px] border border-[var(--line)] bg-white/70 px-3 py-1.5 text-xs font-medium transition hover:bg-white disabled:opacity-50"
              >
                {isLoading ? "Đang tải…" : "Làm mới"}
              </button>
              {totalCount > 0 && (
                <button
                  onClick={() => void handleDeleteAll()}
                  className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                >
                  Xóa tất cả
                </button>
              )}
            </div>
          </div>

          {loadError && (
            <p className="text-sm text-red-600">{loadError}</p>
          )}

          {isLoading && !submissions && (
            <p className="text-sm text-[color:rgba(31,26,23,0.5)]">Đang tải dữ liệu…</p>
          )}

          {submissions !== null && submissions.length === 0 && (
            <p className="rounded-[16px] border border-[var(--line)] bg-white/50 px-5 py-8 text-center text-sm text-[color:rgba(31,26,23,0.5)]">
              Chưa có bài nộp nào.
            </p>
          )}

          {submissions !== null && submissions.length > 0 && (
            <div className="overflow-x-auto rounded-[20px] border border-[var(--line)] bg-white/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-deep)]">
                      Thời gian
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-deep)]">
                      Tổ chức
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-deep)]">
                      Học sinh
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-deep)]">
                      File
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-deep)]">
                      Kích thước
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((rec) => (
                    <tr
                      key={rec.submissionId}
                      className="border-b border-[var(--line)] last:border-0"
                    >
                      <td className="px-4 py-3 text-xs text-[color:rgba(31,26,23,0.65)]">
                        {formatDateTime(rec.savedAt)}
                      </td>
                      <td className="px-4 py-3">{rec.organizationName}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{rec.displayName}</span>
                        <span className="ml-2 text-xs text-[color:rgba(31,26,23,0.5)]">
                          @{rec.username}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{rec.fileCount}</td>
                      <td className="px-4 py-3 text-right text-xs text-[color:rgba(31,26,23,0.65)]">
                        {formatBytes(rec.totalBytes)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => void handleDeleteOne(rec)}
                          className="rounded-[10px] border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
