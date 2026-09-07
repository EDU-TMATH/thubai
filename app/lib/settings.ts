import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getLegacySettingsFile,
  getSettingsFile,
  getSubmissionStorageDir,
} from "@/app/lib/env";

export type AppSettings = {
  submissionStart: string | null;
  submissionEnd: string | null;
  storagePrefix: string;
};

function getDefaultSettings(): AppSettings {
  return {
    submissionStart: null,
    submissionEnd: null,
    storagePrefix: getSubmissionStorageDir(),
  };
}

export async function loadSettings(): Promise<AppSettings> {
  const settingsFile = getSettingsFile();
  const legacySettingsFile = getLegacySettingsFile();
  const candidateFiles = [settingsFile];
  if (legacySettingsFile !== settingsFile) {
    candidateFiles.push(legacySettingsFile);
  }

  for (const candidateFile of candidateFiles) {
    try {
      const raw = await readFile(candidateFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        submissionStart: parsed.submissionStart ?? null,
        submissionEnd: parsed.submissionEnd ?? null,
        storagePrefix: parsed.storagePrefix?.trim() || getSubmissionStorageDir(),
      };
    } catch {
      continue;
    }
  }

  return getDefaultSettings();
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const settingsFile = getSettingsFile();
  await mkdir(path.dirname(settingsFile), { recursive: true });
  await writeFile(settingsFile, JSON.stringify(settings, null, 2), "utf8");
}

export type WindowStatus = "open" | "pending" | "closed" | "unconfigured";

export function getWindowStatus(settings: AppSettings): {
  status: WindowStatus;
  start: Date | null;
  end: Date | null;
} {
  if (!settings.submissionStart || !settings.submissionEnd) {
    return { status: "unconfigured", start: null, end: null };
  }

  const now = new Date();
  const start = new Date(settings.submissionStart);
  const end = new Date(settings.submissionEnd);

  if (now < start) return { status: "pending", start, end };
  if (now > end) return { status: "closed", start, end };
  return { status: "open", start, end };
}

export function isSubmissionOpen(settings: AppSettings): boolean {
  const { status } = getWindowStatus(settings);
  return status === "open" || status === "unconfigured";
}
