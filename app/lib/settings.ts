import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  LEGACY_SETTINGS_FILE,
  SETTINGS_FILE,
  SUBMISSION_STORAGE_DIR,
} from "@/app/lib/env";

export type AppSettings = {
  submissionStart: string | null;
  submissionEnd: string | null;
  storagePrefix: string;
};

const DEFAULT: AppSettings = {
  submissionStart: null,
  submissionEnd: null,
  storagePrefix: SUBMISSION_STORAGE_DIR,
};

export async function loadSettings(): Promise<AppSettings> {
  const candidateFiles = [SETTINGS_FILE];
  if (LEGACY_SETTINGS_FILE !== SETTINGS_FILE) {
    candidateFiles.push(LEGACY_SETTINGS_FILE);
  }

  for (const candidateFile of candidateFiles) {
    try {
      const raw = await readFile(candidateFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        submissionStart: parsed.submissionStart ?? null,
        submissionEnd: parsed.submissionEnd ?? null,
        storagePrefix: parsed.storagePrefix?.trim() || SUBMISSION_STORAGE_DIR,
      };
    } catch {
      continue;
    }
  }

  return { ...DEFAULT };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
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
