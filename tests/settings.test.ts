import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

async function importSettingsModule() {
  return import("@/app/lib/settings");
}

describe("settings helpers", () => {
  let tempRoot = "";

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.useRealTimers();

    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = "";
    }
  });

  it("reads and writes settings in the configured data directory", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "thubai-settings-"));
    vi.resetModules();
    vi.stubEnv("DATA_DIR", tempRoot);

    const { loadSettings, saveSettings } = await importSettingsModule();

    const initial = await loadSettings();
    expect(initial.storagePrefix).toBe("/tmp");

    await saveSettings({
      submissionStart: "2026-09-07T08:00:00.000Z",
      submissionEnd: "2026-09-07T10:00:00.000Z",
      storagePrefix: path.join(tempRoot, "custom-storage"),
    });

    const persisted = await loadSettings();
    expect(persisted).toEqual({
      submissionStart: "2026-09-07T08:00:00.000Z",
      submissionEnd: "2026-09-07T10:00:00.000Z",
      storagePrefix: path.join(tempRoot, "custom-storage"),
    });

    const settingsPath = path.join(tempRoot, "thubai-settings.json");
    const raw = await readFile(settingsPath, "utf8");
    expect(JSON.parse(raw)).toMatchObject({
      storagePrefix: path.join(tempRoot, "custom-storage"),
    });
  });

  it("reports window state from the current time", async () => {
    vi.resetModules();
    vi.stubEnv("DATA_DIR", "/tmp/thubai-test-data");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T09:00:00.000Z"));

    const { getWindowStatus, isSubmissionOpen } = await importSettingsModule();

    expect(
      getWindowStatus({
        submissionStart: "2026-09-07T08:00:00.000Z",
        submissionEnd: "2026-09-07T10:00:00.000Z",
        storagePrefix: "/tmp/thubai-test-data/submissions",
      }),
    ).toMatchObject({ status: "open" });

    expect(
      getWindowStatus({
        submissionStart: "2026-09-07T10:00:00.000Z",
        submissionEnd: "2026-09-07T12:00:00.000Z",
        storagePrefix: "/tmp/thubai-test-data/submissions",
      }),
    ).toMatchObject({ status: "pending" });

    expect(
      isSubmissionOpen({
        submissionStart: null,
        submissionEnd: null,
        storagePrefix: "/tmp/thubai-test-data/submissions",
      }),
    ).toBe(true);
  });
});
