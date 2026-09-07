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
  organizationRules: Record<string, OrganizationRule>;
};

export type OrganizationRule = {
  submissionStart: string | null;
  submissionEnd: string | null;
  storagePrefix: string | null;
};

function normalizeOrgKey(value: string) {
  return value.trim().toLowerCase();
}

function getDefaultSettings(): AppSettings {
  return {
    submissionStart: null,
    submissionEnd: null,
    storagePrefix: getSubmissionStorageDir(),
    organizationRules: {},
  };
}

function normalizeOrganizationRules(
  input: Partial<Record<string, Partial<OrganizationRule>>> | null | undefined,
): Record<string, OrganizationRule> {
  if (!input) {
    return {};
  }

  const entries = Object.entries(input)
    .map(([key, value]) => [normalizeOrgKey(key), value] as const)
    .filter(([key]) => key.length > 0);

  return Object.fromEntries(
    entries.map(([key, value]) => [
      key,
      {
        submissionStart: value?.submissionStart ?? null,
        submissionEnd: value?.submissionEnd ?? null,
        storagePrefix: value?.storagePrefix?.trim() || null,
      } satisfies OrganizationRule,
    ]),
  );
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
      const parsed = JSON.parse(raw) as Partial<AppSettings> & {
        organizationRules?: Partial<Record<string, Partial<OrganizationRule>>>;
      };
      return {
        submissionStart: parsed.submissionStart ?? null,
        submissionEnd: parsed.submissionEnd ?? null,
        storagePrefix: parsed.storagePrefix?.trim() || getSubmissionStorageDir(),
        organizationRules: normalizeOrganizationRules(parsed.organizationRules),
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

export function getEffectiveSubmissionConfig(
  settings: AppSettings,
  organizationKey?: string,
): {
  submissionStart: string | null;
  submissionEnd: string | null;
  storagePrefix: string;
} {
  const orgKey = organizationKey ? normalizeOrgKey(organizationKey) : "";
  const orgRule = orgKey ? settings.organizationRules[orgKey] ?? null : null;

  return {
    submissionStart: orgRule?.submissionStart ?? settings.submissionStart,
    submissionEnd: orgRule?.submissionEnd ?? settings.submissionEnd,
    storagePrefix: orgRule?.storagePrefix ?? settings.storagePrefix,
  };
}

export function getWindowStatus(settings: AppSettings, organizationKey?: string): {
  status: WindowStatus;
  start: Date | null;
  end: Date | null;
} {
  const effective = getEffectiveSubmissionConfig(settings, organizationKey);

  if (!effective.submissionStart || !effective.submissionEnd) {
    return { status: "unconfigured", start: null, end: null };
  }

  const now = new Date();
  const start = new Date(effective.submissionStart);
  const end = new Date(effective.submissionEnd);

  if (now < start) return { status: "pending", start, end };
  if (now > end) return { status: "closed", start, end };
  return { status: "open", start, end };
}

export function isSubmissionOpen(settings: AppSettings, organizationKey?: string): boolean {
  const { status } = getWindowStatus(settings, organizationKey);
  return status === "open" || status === "unconfigured";
}
