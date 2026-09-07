"use client";

import { useCallback, useState } from "react";
import {
  ArrowsClockwiseIcon,
  ChartBarIcon,
  ClipboardTextIcon,
  FloppyDiskIcon,
  GearIcon,
  TrashIcon,
} from "@phosphor-icons/react";

type AppSettings = {
  submissionStart: string | null;
  submissionEnd: string | null;
  storagePrefix: string;
  organizationRules: Record<string, {
    submissionStart: string | null;
    submissionEnd: string | null;
    storagePrefix: string | null;
  }>;
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

type SystemStatus = {
  judgeApi: {
    status: "ok" | "error";
    message: string;
  };
  storage: {
    path: string;
    writable: boolean;
    status: "ok" | "error";
    message: string;
  };
  files: {
    settingsFile: string;
    settingsExists: boolean;
    historyDbFile: string;
    historyDbExists: boolean;
  };
};

type Analytics = {
  dailyTrend: Array<{ date: string; count: number }>;
  organizationBreakdown: Array<{
    org: string;
    organizationName: string;
    count: number;
    files: number;
    bytes: number;
  }>;
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

const TABS = [
  { id: "settings", label: "Cài đặt", Icon: GearIcon },
  { id: "stats", label: "Thống kê", Icon: ChartBarIcon },
  { id: "submissions", label: "Bài nộp", Icon: ClipboardTextIcon },
] satisfies { id: Tab; label: string; Icon: typeof GearIcon }[];

export default function AdminPanel({ initialSettings }: { initialSettings: AppSettings }) {
  const [tab, setTab] = useState<Tab>("settings");

  // Settings form state
  const [startInput, setStartInput] = useState(toDatetimeLocal(initialSettings.submissionStart));
  const [endInput, setEndInput] = useState(toDatetimeLocal(initialSettings.submissionEnd));
  const [prefixInput, setPrefixInput] = useState(initialSettings.storagePrefix);
  const [orgRulesInput, setOrgRulesInput] = useState(
    JSON.stringify(initialSettings.organizationRules, null, 2),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Stats state
  const [submissions, setSubmissions] = useState<SubmissionRecord[] | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
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
      const data = (await res.json()) as {
        submissions: SubmissionRecord[];
        analytics: Analytics;
        system: SystemStatus;
      };
      setSubmissions(data.submissions);
      setAnalytics(data.analytics);
      setSystemStatus(data.system);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Lỗi tải dữ liệu.");
      setSubmissions([]);
      setAnalytics(null);
      setSystemStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  function handleTabChange(nextTab: Tab) {
    setTab(nextTab);

    if (nextTab !== "settings" && submissions === null) {
      void fetchStats();
    }
  }

  async function handleSaveSettings() {
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const parsedOrgRules = orgRulesInput.trim()
        ? (JSON.parse(orgRulesInput) as AppSettings["organizationRules"])
        : {};
      const body: AppSettings = {
        submissionStart: fromDatetimeLocal(startInput),
        submissionEnd: fromDatetimeLocal(endInput),
        storagePrefix: prefixInput.trim() || initialSettings.storagePrefix,
        organizationRules: parsedOrgRules,
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
    } catch (error) {
      setSaveMsg({
        ok: false,
        text: error instanceof SyntaxError ? "JSON cấu hình theo tổ chức không hợp lệ." : "Không thể kết nối máy chủ.",
      });
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
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-[14px] py-2 text-sm font-semibold transition ${
              tab === id
                ? "bg-(--accent) text-white shadow-sm"
                : "text-[rgba(31,26,23,0.6)] hover:bg-white/80"
            }`}
          >
            <Icon size={18} weight={tab === id ? "fill" : "duotone"} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* ───── Settings Tab ───── */}
      {tab === "settings" && (
        <div className="space-y-5">
          {/* Time window card */}
          <div className="rounded-[20px] border border-(--line) bg-white/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-(--accent-deep)">
                Thời gian thu bài
              </h3>
              <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${windowStatusColor}`}>
                {windowStatusLabel}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-xs font-medium text-[rgba(31,26,23,0.6)]">
                  Bắt đầu
                </span>
                <input
                  type="datetime-local"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  className="w-full rounded-[14px] border border-(--line) bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)/40"
                />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-medium text-[rgba(31,26,23,0.6)]">
                  Kết thúc
                </span>
                <input
                  type="datetime-local"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  className="w-full rounded-[14px] border border-(--line) bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)/40"
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-[rgba(31,26,23,0.5)]">
              Để trống cả hai ô để mở thu bài không giới hạn thời gian.
            </p>
          </div>

          {/* Storage prefix card */}
          <div className="rounded-[20px] border border-(--line) bg-white/60 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-(--accent-deep)">
              Thư mục lưu bài
            </h3>
            <label className="space-y-1.5">
              <span className="block text-xs font-medium text-[rgba(31,26,23,0.6)]">
                Đường dẫn thư mục gốc
              </span>
              <input
                type="text"
                value={prefixInput}
                onChange={(e) => setPrefixInput(e.target.value)}
                placeholder={initialSettings.storagePrefix}
                className="w-full rounded-[14px] border border-(--line) bg-white/80 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)/40"
              />
            </label>
            <p className="mt-3 text-xs text-[rgba(31,26,23,0.5)]">
              Bài nộp sẽ được lưu vào <code className="font-mono">{prefixInput || initialSettings.storagePrefix}
              /&lt;tổ-chức&gt;/&lt;tài-khoản&gt;/&lt;id&gt;/</code>
            </p>
          </div>

          <div className="rounded-[20px] border border-(--line) bg-white/60 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-(--accent-deep)">
              Cấu hình theo tổ chức (JSON)
            </h3>
            <label className="space-y-1.5">
              <span className="block text-xs font-medium text-[rgba(31,26,23,0.6)]">
                <code className="font-mono">short_name</code> &rarr;{" "}
                <code className="font-mono">submissionStart</code>,{" "}
                <code className="font-mono">submissionEnd</code>,{" "}
                <code className="font-mono">storagePrefix</code>
              </span>
              <textarea
                value={orgRulesInput}
                onChange={(e) => setOrgRulesInput(e.target.value)}
                rows={10}
                spellCheck={false}
                className="w-full rounded-[14px] border border-(--line) bg-white/80 px-3 py-2 font-mono text-xs leading-6 focus:outline-none focus:ring-2 focus:ring-(--accent)/40"
              />
            </label>
            <p className="mt-3 text-xs text-[rgba(31,26,23,0.5)]">
              Nếu để trống, tổ chức sẽ dùng cấu hình chung. Có thể đặt riêng thời gian và thư mục lưu cho từng tổ chức.
            </p>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => void handleSaveSettings()}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-(--accent) px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-(--accent-deep) disabled:opacity-50"
            >
              <FloppyDiskIcon size={18} weight="bold" aria-hidden="true" />
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
                className="rounded-[20px] border border-(--line) bg-white/60 p-4 text-center"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--accent-deep)">
                  {label}
                </p>
                <p className="mt-2 text-3xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          {systemStatus && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[20px] border border-(--line) bg-white/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--accent-deep)">
                  Trạng thái Judge API
                </p>
                <p className={`mt-2 text-sm font-semibold ${systemStatus.judgeApi.status === "ok" ? "text-emerald-700" : "text-red-700"}`}>
                  {systemStatus.judgeApi.message}
                </p>
              </div>

              <div className="rounded-[20px] border border-(--line) bg-white/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--accent-deep)">
                  Trạng thái lưu trữ
                </p>
                <p className={`mt-2 text-sm font-semibold ${systemStatus.storage.status === "ok" ? "text-emerald-700" : "text-red-700"}`}>
                  {systemStatus.storage.message}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-[rgba(31,26,23,0.62)]">
                  {systemStatus.storage.path}
                </p>
              </div>
            </div>
          )}

          {analytics && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[20px] border border-(--line) bg-white/60 p-4">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-(--accent-deep)">
                  Xu hướng nộp 14 ngày
                </p>
                <div className="flex items-end gap-2">
                  {analytics.dailyTrend.map((item) => {
                    const maxCount = Math.max(...analytics.dailyTrend.map((entry) => entry.count), 1);
                    const height = Math.max(18, Math.round((item.count / maxCount) * 120));
                    return (
                      <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div className="flex h-[132px] w-full items-end justify-center">
                          <div
                            className="w-full rounded-t-xl bg-(--accent)"
                            style={{ height: `${height}px` }}
                            title={`${item.date}: ${item.count}`}
                          />
                        </div>
                        <div className="text-[10px] text-[rgba(31,26,23,0.55)]">
                          {item.date.slice(5)}
                        </div>
                        <div className="text-xs font-semibold text-(--accent-deep)">{item.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[20px] border border-(--line) bg-white/60 p-4">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-(--accent-deep)">
                  Top tổ chức
                </p>
                <div className="space-y-3">
                  {analytics.organizationBreakdown.slice(0, 5).map((item) => (
                    <div key={item.org} className="rounded-2xl border border-(--line) bg-white/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{item.organizationName}</p>
                          <p className="text-xs text-[rgba(31,26,23,0.55)]">{item.org}</p>
                        </div>
                        <div className="text-right text-sm font-semibold text-(--accent-deep)">
                          {item.count} lượt
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[rgba(31,26,23,0.62)]">
                        <span>{item.files} file</span>
                        <span>{Math.round(item.bytes / 1024)} KB</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {systemStatus && (
            <div className="rounded-[20px] border border-(--line) bg-white/60 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-(--accent-deep)">
                Tệp hệ thống
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <span className="font-medium">Settings JSON</span>
                  <span className={systemStatus.files.settingsExists ? "text-emerald-700" : "text-amber-700"}>
                    {systemStatus.files.settingsExists ? "Đã tồn tại" : "Chưa tạo"}
                  </span>
                </div>
                <p className="break-all font-mono text-xs text-[rgba(31,26,23,0.62)]">
                  {systemStatus.files.settingsFile}
                </p>

                <div className="mt-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <span className="font-medium">History DB</span>
                  <span className={systemStatus.files.historyDbExists ? "text-emerald-700" : "text-amber-700"}>
                    {systemStatus.files.historyDbExists ? "Đã tồn tại" : "Chưa tạo"}
                  </span>
                </div>
                <p className="break-all font-mono text-xs text-[rgba(31,26,23,0.62)]">
                  {systemStatus.files.historyDbFile}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-(--accent-deep)">
              Chi tiết theo học sinh
            </h3>
            <button
              onClick={() => void fetchStats()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-(--line) bg-white/70 px-3 py-1.5 text-xs font-medium transition hover:bg-white disabled:opacity-50"
            >
              <ArrowsClockwiseIcon size={15} weight="bold" aria-hidden="true" />
              {isLoading ? "Đang tải…" : "Làm mới"}
            </button>
          </div>

          {loadError && (
            <p className="text-sm text-red-600">{loadError}</p>
          )}

          {isLoading && !submissions && (
            <p className="text-sm text-[rgba(31,26,23,0.5)]">Đang tải dữ liệu…</p>
          )}

          {submissions !== null && userStats.length === 0 && (
            <p className="rounded-2xl border border-(--line) bg-white/50 px-5 py-8 text-center text-sm text-[rgba(31,26,23,0.5)]">
              Chưa có bài nộp nào.
            </p>
          )}

          {userStats.length > 0 && (
            <div className="overflow-x-auto rounded-[20px] border border-(--line) bg-white/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-(--line) text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
                      Tổ chức
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
                      Học sinh
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
                      Lần nộp
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
                      Nộp lần cuối
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {userStats.map((stat) => (
                    <tr
                      key={`${stat.org}-${stat.username}`}
                      className="border-b border-(--line) last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{stat.organizationName}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{stat.displayName}</span>
                        <span className="ml-2 text-xs text-[rgba(31,26,23,0.5)]">
                          @{stat.username}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-(--accent-deep)">
                        {stat.count}
                      </td>
                      <td className="px-4 py-3 text-[rgba(31,26,23,0.65)]">
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
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-(--accent-deep)">
              Tất cả bài nộp ({totalCount})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => void fetchStats()}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-(--line) bg-white/70 px-3 py-1.5 text-xs font-medium transition hover:bg-white disabled:opacity-50"
              >
                <ArrowsClockwiseIcon size={15} weight="bold" aria-hidden="true" />
                {isLoading ? "Đang tải…" : "Làm mới"}
              </button>
              {totalCount > 0 && (
                <button
                  onClick={() => void handleDeleteAll()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                >
                  <TrashIcon size={15} weight="bold" aria-hidden="true" />
                  Xóa tất cả
                </button>
              )}
            </div>
          </div>

          {loadError && (
            <p className="text-sm text-red-600">{loadError}</p>
          )}

          {isLoading && !submissions && (
            <p className="text-sm text-[rgba(31,26,23,0.5)]">Đang tải dữ liệu…</p>
          )}

          {submissions !== null && submissions.length === 0 && (
            <p className="rounded-2xl border border-(--line) bg-white/50 px-5 py-8 text-center text-sm text-[rgba(31,26,23,0.5)]">
              Chưa có bài nộp nào.
            </p>
          )}

          {submissions !== null && submissions.length > 0 && (
            <div className="overflow-x-auto rounded-[20px] border border-(--line) bg-white/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-(--line) text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
                      Thời gian
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
                      Tổ chức
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
                      Học sinh
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
                      File
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-(--accent-deep)">
                      Kích thước
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((rec) => (
                    <tr
                      key={rec.submissionId}
                      className="border-b border-(--line) last:border-0"
                    >
                      <td className="px-4 py-3 text-xs text-[rgba(31,26,23,0.65)]">
                        {formatDateTime(rec.savedAt)}
                      </td>
                      <td className="px-4 py-3">{rec.organizationName}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{rec.displayName}</span>
                        <span className="ml-2 text-xs text-[rgba(31,26,23,0.5)]">
                          @{rec.username}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{rec.fileCount}</td>
                      <td className="px-4 py-3 text-right text-xs text-[rgba(31,26,23,0.65)]">
                        {formatBytes(rec.totalBytes)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => void handleDeleteOne(rec)}
                          className="inline-flex items-center gap-1.5 rounded-[10px] border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          <TrashIcon size={14} weight="bold" aria-hidden="true" />
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
