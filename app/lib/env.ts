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

export const DATA_DIR = resolvePathFromRoot(
  readEnv("DATA_DIR") ?? path.join("var", "thubai"),
);
export const SUBMISSION_STORAGE_DIR = resolvePathFromRoot(
  readEnv("SUBMISSION_STORAGE_DIR") ?? path.join(DATA_DIR, "submissions"),
);
export const SETTINGS_FILE = resolvePathFromRoot(
  readEnv("SETTINGS_FILE") ?? path.join(DATA_DIR, "thubai-settings.json"),
);
export const HISTORY_DB_FILE = resolvePathFromRoot(
  readEnv("DB_PATH") ?? path.join(DATA_DIR, "thubai-history.sqlite"),
);

export const LEGACY_SETTINGS_FILE = path.join(process.cwd(), "thubai-settings.json");
export const LEGACY_HISTORY_DB_FILE = path.join(process.cwd(), "thubai-history.sqlite");
