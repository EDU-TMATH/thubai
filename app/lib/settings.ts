import "server-only";

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SETTINGS_FILE = path.join(process.cwd(), "thubai-settings.json");

export type AppSettings = {
  submissionStart: string | null;
  submissionEnd: string | null;
  storagePrefix: string;
};

const DEFAULT: AppSettings = {
  submissionStart: null,
  submissionEnd: null,
  storagePrefix: "/tmp",
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      submissionStart: parsed.submissionStart ?? null,
      submissionEnd: parsed.submissionEnd ?? null,
      storagePrefix: parsed.storagePrefix?.trim() || "/tmp",
    };
  } catch {
    return { ...DEFAULT };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
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
