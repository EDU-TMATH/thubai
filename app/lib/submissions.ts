import "server-only";

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { CurrentUser, OrganizationSummary } from "@/app/lib/judge-api";

export const ACCEPTED_EXTENSIONS = [".cpp", ".py", ".pas"] as const;
export const MAX_TOTAL_UPLOAD_SIZE = 1024 * 1024;

export type SubmissionRecord = {
  submissionId: string;
  org: string;
  username: string;
  displayName: string;
  organizationName: string;
  savedAt: string;
  fileCount: number;
  totalBytes: number;
  destination: string;
};

export type SavedSubmission = {
  submissionId: string;
  savedAt: string;
  destination: string;
  fileCount: number;
  totalBytes: number;
};

function sanitizeSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "unknown";
}

function getFileExtension(filename: string) {
  return path.extname(filename).toLowerCase();
}

function splitFilename(filename: string) {
  const rawExtension = path.extname(filename);
  if (!rawExtension) {
    return {
      baseName: filename,
      extension: "",
    };
  }

  return {
    baseName: filename.slice(0, -rawExtension.length),
    extension: rawExtension.toLowerCase(),
  };
}

function sanitizeFilename(filename: string) {
  const { baseName, extension } = splitFilename(path.basename(filename));
  const sanitizedBase = sanitizeSegment(baseName);
  return `${sanitizedBase}${extension}`;
}

function formatSubmissionPartition(savedAt: string) {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) {
    return {
      year: "unknown-year",
      month: "unknown-month",
    };
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    year: String(date.getUTCFullYear()),
    month: pad(date.getUTCMonth() + 1),
  };
}

function buildSubmissionDestination(
  baseDir: string,
  organizationShortName: string,
  userIdentifier: string,
  submissionId: string,
  savedAt: string,
) {
  const partition = formatSubmissionPartition(savedAt);
  return path.join(
    baseDir,
    sanitizeSegment(organizationShortName),
    partition.year,
    partition.month,
    sanitizeSegment(userIdentifier),
    submissionId,
  );
}

async function walkSubmissionDirectories(
  currentPath: string,
  collector: string[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(currentPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const nextPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      await walkSubmissionDirectories(nextPath, collector);
      continue;
    }

    if (entry.isFile() && entry.name === "metadata.json") {
      collector.push(nextPath);
    }
  }
}

function getSanitizedFilenames(files: File[]) {
  return files.map((file) => sanitizeFilename(file.name));
}

function findDuplicateFilename(filenames: string[]) {
  const seen = new Set<string>();
  return filenames.find((filename) => {
    if (seen.has(filename)) return true;
    seen.add(filename);
    return false;
  });
}

export function validateSubmissionFiles(files: File[]) {
  if (files.length === 0) {
    return { error: "Vui lòng chọn ít nhất một file bài làm." };
  }

  const invalidFile = files.find(
    (file) => !ACCEPTED_EXTENSIONS.includes(getFileExtension(file.name) as never),
  );
  if (invalidFile) {
    return {
      error: `File ${invalidFile.name} không hợp lệ. Chỉ nhận ${ACCEPTED_EXTENSIONS.join(", ")}.`,
    };
  }

  const duplicateFilename = findDuplicateFilename(getSanitizedFilenames(files));
  if (duplicateFilename) {
    return {
      error: `Nhiều file sẽ được lưu cùng tên ${duplicateFilename}. Vui lòng đổi tên file và thử lại.`,
    };
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_UPLOAD_SIZE) {
    return {
      error: `Tổng dung lượng vượt quá ${Math.round(MAX_TOTAL_UPLOAD_SIZE / 1024)} KB.`,
    };
  }

  return { totalBytes };
}

export async function saveSubmission(
  user: CurrentUser,
  organization: OrganizationSummary,
  files: File[],
  baseDir: string,
): Promise<SavedSubmission> {
  const sanitizedFilenames = getSanitizedFilenames(files);
  if (findDuplicateFilename(sanitizedFilenames)) {
    throw new Error("Submission contains duplicate normalized filenames.");
  }

  const submissionId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const savedAt = new Date().toISOString();
  const destination = buildSubmissionDestination(
    baseDir,
    organization.short_name,
    `${user.id}_${user.username}`,
    submissionId,
    savedAt,
  );

  await mkdir(destination, { recursive: true });

  let totalBytes = 0;
  for (const [index, file] of files.entries()) {
    const bytes = Buffer.from(await file.arrayBuffer());
    totalBytes += bytes.byteLength;
    await writeFile(path.join(destination, sanitizedFilenames[index]), bytes);
  }

  await writeFile(
    path.join(destination, "metadata.json"),
    JSON.stringify(
      {
        storageVersion: 2,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
        },
        organization,
        savedAt,
        destination,
        files: files.map((file, index) => ({
          name: sanitizedFilenames[index],
          size: file.size,
          type: file.type,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    submissionId,
    savedAt,
    destination,
    fileCount: files.length,
    totalBytes,
  };
}

export async function listSubmissions(baseDir: string): Promise<SubmissionRecord[]> {
  const results: SubmissionRecord[] = [];
  const metadataFiles: string[] = [];
  await walkSubmissionDirectories(baseDir, metadataFiles);

  for (const metadataPath of metadataFiles) {
    try {
      const raw = await readFile(metadataPath, "utf8");
      const meta = JSON.parse(raw) as {
        user?: { id?: number; username?: string; displayName?: string };
        organization?: { name?: string; short_name?: string };
        savedAt?: string;
        destination?: string;
        files?: { size?: number }[];
      };
      const destination = meta.destination ?? path.dirname(metadataPath);
      const fileList = meta.files ?? [];
      const resolvedPath = path.resolve(destination);
      const pathParts = resolvedPath.split(path.sep).filter(Boolean);
      const fallbackSubmissionId = path.basename(resolvedPath);
      const fallbackUsername = pathParts.at(-2) ?? "unknown";
      const fallbackOrg = pathParts.at(-5) ?? pathParts.at(-1) ?? "unknown";
      results.push({
        submissionId: fallbackSubmissionId,
        org: meta.organization?.short_name ?? fallbackOrg,
        username: meta.user?.username ?? fallbackUsername,
        displayName: meta.user?.displayName ?? fallbackUsername,
        organizationName: meta.organization?.name ?? fallbackOrg,
        savedAt: meta.savedAt ?? new Date(0).toISOString(),
        fileCount: fileList.length,
        totalBytes: fileList.reduce((s, f) => s + (f.size ?? 0), 0),
        destination: resolvedPath,
      });
    } catch {
      /* skip unreadable entries */
    }
  }

  return results.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function deleteSubmission(
  baseDir: string,
  org: string,
  username: string,
  submissionId: string,
): Promise<void> {
  const submissions = await listSubmissions(baseDir);
  const match = submissions.find(
    (submission) =>
      submission.org === org
      && submission.username === username
      && submission.submissionId === submissionId,
  );

  if (!match) {
    return;
  }

  await deleteSubmissionAtDestination(match.destination, submissionId);
}

export async function deleteSubmissionAtDestination(
  destination: string,
  submissionId: string,
): Promise<void> {
  const resolvedDestination = path.resolve(destination);

  if (
    path.basename(resolvedDestination) !== submissionId
    || path.dirname(resolvedDestination) === resolvedDestination
  ) {
    throw new Error("Invalid submission destination.");
  }

  await rm(resolvedDestination, {
    recursive: true,
    force: true,
  });
}

export async function deleteAllSubmissions(baseDir: string): Promise<void> {
  const submissions = await listSubmissions(baseDir);
  for (const submission of submissions) {
    try {
      await deleteSubmissionAtDestination(submission.destination, submission.submissionId);
    } catch {
      /* continue deleting remaining submissions */
    }
  }
}
