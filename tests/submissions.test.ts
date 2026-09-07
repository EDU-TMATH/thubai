import path from "node:path";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser, OrganizationSummary } from "@/app/lib/judge-api";

async function importSubmissionsModule() {
  vi.resetModules();
  return import("@/app/lib/submissions");
}

const user: CurrentUser = {
  id: 12,
  username: "alice",
  display_name: "Alice Nguyen",
  organization: null,
  organizations: [],
  is_superuser: false,
  is_staff: false,
};

const organization: OrganizationSummary = {
  id: 4,
  name: "Olympiad Team",
  short_name: "OLY",
};

describe("submission helpers", () => {
  let tempRoot = "";

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = "";
    }
  });

  it("validates file types, duplicate names, and size limits", async () => {
    const { validateSubmissionFiles, MAX_TOTAL_UPLOAD_SIZE } = await importSubmissionsModule();

    expect(validateSubmissionFiles([])).toEqual({
      error: "Vui lòng chọn ít nhất một file bài làm.",
    });

    expect(
      validateSubmissionFiles([new File(["hello"], "notes.txt", { type: "text/plain" })]),
    ).toEqual({
      error: "File notes.txt không hợp lệ. Chỉ nhận .cpp, .py, .pas.",
    });

    expect(
      validateSubmissionFiles([
        new File(["a"], "Problem One.cpp"),
        new File(["b"], "problem-one.cpp"),
      ]),
    ).toEqual({
      error: "Nhiều file sẽ được lưu cùng tên problem-one.cpp. Vui lòng đổi tên file và thử lại.",
    });

    expect(
      validateSubmissionFiles([
        new File([new Uint8Array(MAX_TOTAL_UPLOAD_SIZE + 1)], "main.cpp"),
      ]),
    ).toEqual({
      error: `Tổng dung lượng vượt quá ${Math.round(MAX_TOTAL_UPLOAD_SIZE / 1024)} KB.`,
    });
  });

  it("saves, lists, and deletes a submission on disk", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "thubai-submissions-"));
    const { saveSubmission, listSubmissions, deleteSubmissionAtDestination } = await importSubmissionsModule();

    const files = [
      new File(["print('hello')"], "Hello World.py", { type: "text/x-python" }),
      new File(["begin end."], "solution.pas", { type: "text/plain" }),
    ];

    const result = await saveSubmission(user, organization, files, tempRoot);

    expect(result.fileCount).toBe(2);
    expect(result.totalBytes).toBeGreaterThan(0);

    const metadataPath = path.join(result.destination, "metadata.json");
    const metadataRaw = await readFile(metadataPath, "utf8");
    expect(JSON.parse(metadataRaw)).toMatchObject({
      user: {
        id: user.id,
        username: user.username,
      },
      organization: {
        short_name: organization.short_name,
      },
    });

    const submissionFiles = await Promise.all([
      stat(path.join(result.destination, "hello-world.py")),
      stat(path.join(result.destination, "solution.pas")),
    ]);
    expect(submissionFiles.every((item) => item.isFile())).toBe(true);

    const listed = await listSubmissions(tempRoot);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      submissionId: result.submissionId,
      org: organization.short_name.toLowerCase(),
      username: `${user.id}_${user.username}`.toLowerCase(),
      fileCount: 2,
      totalBytes: result.totalBytes,
    });

    await deleteSubmissionAtDestination(result.destination, result.submissionId);
    await expect(stat(result.destination)).rejects.toThrow();
  });
});
