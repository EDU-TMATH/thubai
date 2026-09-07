import "server-only";

import path from "node:path";

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function resolvePathFromRoot(value: string): string {
  return path.resolve(value);
}

const isProduction = process.env.NODE_ENV === "production";
const configuredSessionSecret = readEnv("SESSION_SECRET");

if (isProduction && !configuredSessionSecret) {
  throw new Error("Missing required environment variable: SESSION_SECRET");
}

export function getSessionSecret(): string {
  return configuredSessionSecret ?? "thubai-dev-session-secret-change-me";
}

export function isProductionEnv(): boolean {
  return isProduction;
}

function resolveConfiguredPath(name: string, fallback: string): string {
  return resolvePathFromRoot(readEnv(name) ?? fallback);
}

export function getDataDir(): string {
  return resolveConfiguredPath("DATA_DIR", path.join("var", "thubai"));
}

export function getSubmissionStorageDir(): string {
  return resolveConfiguredPath("SUBMISSION_STORAGE_DIR", path.join(getDataDir(), "submissions"));
}

export function getSettingsFile(): string {
  return resolveConfiguredPath("SETTINGS_FILE", path.join(getDataDir(), "thubai-settings.json"));
}

export function getHistoryDbFile(): string {
  return resolveConfiguredPath("DB_PATH", path.join(getDataDir(), "thubai-history.sqlite"));
}

export function getLegacySettingsFile(): string {
  return path.join(process.cwd(), "thubai-settings.json");
}

export function getLegacyHistoryDbFile(): string {
  return path.join(process.cwd(), "thubai-history.sqlite");
}
