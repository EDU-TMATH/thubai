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
  const submissionId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const destination = path.join(
    baseDir,
    sanitizeSegment(organization.short_name),
    sanitizeSegment(`${user.id}_${user.username}`),
    submissionId,
  );
  const savedAt = new Date().toISOString();

  await mkdir(destination, { recursive: true });

  let totalBytes = 0;
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    totalBytes += bytes.byteLength;
    await writeFile(path.join(destination, sanitizeFilename(file.name)), bytes);
  }

  await writeFile(
    path.join(destination, "metadata.json"),
    JSON.stringify(
      {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
        },
        organization,
        savedAt,
        files: files.map((file) => ({
          name: sanitizeFilename(file.name),
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

  let orgEntries;
  try {
    orgEntries = await readdir(baseDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const orgEntry of orgEntries) {
    if (!orgEntry.isDirectory()) continue;
    const orgPath = path.join(baseDir, orgEntry.name);

    let userEntries;
    try {
      userEntries = await readdir(orgPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const userEntry of userEntries) {
      if (!userEntry.isDirectory()) continue;
      const userPath = path.join(orgPath, userEntry.name);

      let subEntries;
      try {
        subEntries = await readdir(userPath, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const subEntry of subEntries) {
        if (!subEntry.isDirectory()) continue;
        try {
          const raw = await readFile(
            path.join(userPath, subEntry.name, "metadata.json"),
            "utf8",
          );
          const meta = JSON.parse(raw) as {
            user?: { displayName?: string };
            organization?: { name?: string };
            savedAt?: string;
            files?: { size?: number }[];
          };
          const fileList = meta.files ?? [];
          results.push({
            submissionId: subEntry.name,
            org: orgEntry.name,
            username: userEntry.name,
            displayName: meta.user?.displayName ?? userEntry.name,
            organizationName: meta.organization?.name ?? orgEntry.name,
            savedAt: meta.savedAt ?? new Date(0).toISOString(),
            fileCount: fileList.length,
            totalBytes: fileList.reduce((s, f) => s + (f.size ?? 0), 0),
          });
        } catch {
          /* skip unreadable entries */
        }
      }
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
  await rm(path.join(baseDir, org, username, submissionId), {
    recursive: true,
    force: true,
  });
}

export async function deleteAllSubmissions(baseDir: string): Promise<void> {
  const submissions = await listSubmissions(baseDir);
  for (const submission of submissions) {
    try {
      await deleteSubmission(
        baseDir,
        submission.org,
        submission.username,
        submission.submissionId,
      );
    } catch {
      /* continue deleting remaining submissions */
    }
  }
}
