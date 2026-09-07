import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import { performance } from "node:perf_hooks";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  fetchCurrentUser: vi.fn(),
  loadSettings: vi.fn(),
  isSubmissionOpen: vi.fn(),
  validateSubmissionFiles: vi.fn(),
  saveSubmission: vi.fn(),
  insertSubmissionHistory: vi.fn(),
  requireSuperuser: vi.fn(),
  getSubmissionHistoryAll: vi.fn(),
}));

vi.mock("@/app/lib/auth", () => ({
  getSession: mocks.getSession,
  createSession: vi.fn(),
  encodeSession: vi.fn(),
  getSessionCookieOptions: vi.fn(),
  validateLoginInput: vi.fn(),
  SESSION_COOKIE_NAME: "thubai-session",
}));

vi.mock("@/app/lib/judge-api", () => ({
  fetchCurrentUser: mocks.fetchCurrentUser,
  extractOrganizations: vi.fn((user: { organizations?: unknown[] }) => user.organizations ?? []),
  loginToJudge: vi.fn(),
  logoutFromJudge: vi.fn(),
  getJudgeApiBaseUrl: vi.fn(),
  getJudgeApiBaseUrlFromRequest: vi.fn(),
}));

vi.mock("@/app/lib/settings", () => ({
  loadSettings: mocks.loadSettings,
  isSubmissionOpen: mocks.isSubmissionOpen,
  getEffectiveSubmissionConfig: vi.fn((settings: { storagePrefix: string }) => ({
    submissionStart: null,
    submissionEnd: null,
    storagePrefix: settings.storagePrefix,
  })),
  getWindowStatus: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock("@/app/lib/submissions", () => ({
  validateSubmissionFiles: mocks.validateSubmissionFiles,
  saveSubmission: mocks.saveSubmission,
}));

vi.mock("@/app/lib/submission-history-db", () => ({
  insertSubmissionHistory: mocks.insertSubmissionHistory,
  getSubmissionHistoryAll: mocks.getSubmissionHistoryAll,
}));

vi.mock("@/app/lib/admin-auth", () => ({
  requireSuperuser: mocks.requireSuperuser,
}));

async function importSubmissionRoute() {
  vi.resetModules();
  return import("@/app/api/submissions/route");
}

async function importAdminStatsRoute() {
  vi.resetModules();
  return import("@/app/api/admin/stats/route");
}

describe("endpoint smoke checks", () => {
  let tempRoot = "";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = "";
    }
  });

  it("handles the submission flow quickly", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "thubai-smoke-"));
    const storageDir = path.join(tempRoot, "storage");
    vi.stubEnv("DATA_DIR", tempRoot);
    vi.stubEnv("SESSION_SECRET", "test-secret");
    vi.stubEnv("NODE_ENV", "development");

    mocks.getSession.mockResolvedValue({
      username: "alice",
      accessToken: "access",
      refreshToken: "refresh",
      tokenType: "Bearer",
      loginAt: new Date().toISOString(),
    });
    mocks.fetchCurrentUser.mockResolvedValue({
      data: {
        id: 1,
        username: "alice",
        display_name: "Alice",
        organization: { id: 7, name: "Olympiad", short_name: "OLY" },
        organizations: [{ id: 7, name: "Olympiad", short_name: "OLY" }],
        is_superuser: false,
        is_staff: false,
      },
      status: 200,
    });
    mocks.loadSettings.mockResolvedValue({
      submissionStart: null,
      submissionEnd: null,
      storagePrefix: storageDir,
    });
    mocks.isSubmissionOpen.mockReturnValue(true);
    mocks.validateSubmissionFiles.mockReturnValue({ totalBytes: 12 });
    mocks.saveSubmission.mockResolvedValue({
      submissionId: "submission-1",
      savedAt: new Date().toISOString(),
      destination: path.join(storageDir, "olympiad", "1_alice", "submission-1"),
      fileCount: 1,
      totalBytes: 12,
    });
    mocks.insertSubmissionHistory.mockResolvedValue(undefined);

    const { POST } = await importSubmissionRoute();

    const formData = new FormData();
    formData.set("organizationId", "7");
    formData.set("files", new File(["print('hello')"], "solution.py", { type: "text/x-python" }));

    const started = performance.now();
    const response = await POST(
      new Request("http://localhost/api/submissions", {
        method: "POST",
        body: formData,
      }),
    );
    const elapsed = performance.now() - started;

    expect(response.status).toBe(200);
    expect(elapsed).toBeLessThan(1000);
    expect(mocks.saveSubmission).toHaveBeenCalledTimes(1);
    expect(mocks.insertSubmissionHistory).toHaveBeenCalledTimes(1);
  });

  it("returns the admin stats payload quickly", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "thubai-smoke-"));
    const storageDir = path.join(tempRoot, "storage");
    vi.stubEnv("DATA_DIR", tempRoot);
    vi.stubEnv("SESSION_SECRET", "test-secret");
    vi.stubEnv("NODE_ENV", "development");

    mocks.requireSuperuser.mockResolvedValue({ ok: true });
    mocks.getSubmissionHistoryAll.mockResolvedValue([
      {
        submissionId: "submission-1",
        organizationShortName: "OLY",
        username: "alice",
        displayName: "Alice",
        organizationName: "Olympiad",
        savedAt: new Date().toISOString(),
        fileCount: 1,
        totalBytes: 12,
        destination: storageDir,
      },
    ]);
    mocks.loadSettings.mockResolvedValue({
      submissionStart: null,
      submissionEnd: null,
      storagePrefix: storageDir,
    });

    const { GET } = await importAdminStatsRoute();

    const started = performance.now();
    const response = await GET(new Request("http://localhost/api/admin/stats"));
    const elapsed = performance.now() - started;

    expect(response.status).toBe(200);
    expect(elapsed).toBeLessThan(1000);
    expect(mocks.getSubmissionHistoryAll).toHaveBeenCalledTimes(1);
  });
});
