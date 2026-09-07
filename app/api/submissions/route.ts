import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/auth";
import { extractOrganizations, fetchCurrentUser } from "@/app/lib/judge-api";
import { getEffectiveSubmissionConfig, isSubmissionOpen, loadSettings } from "@/app/lib/settings";
import { insertSubmissionHistory } from "@/app/lib/submission-history-db";
import { saveSubmission, validateSubmissionFiles } from "@/app/lib/submissions";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
    }

    const formData = await request.formData();
    const organizationId = String(formData.get("organizationId") ?? "").trim();
    const files = formData
        .getAll("files")
        .filter((entry): entry is File => entry instanceof File);

    if (!organizationId) {
        return NextResponse.json({ error: "Vui lòng chọn tổ chức." }, { status: 400 });
    }

    const settings = await loadSettings();
    if (!isSubmissionOpen(settings)) {
        return NextResponse.json(
            { error: "Hiện tại không trong thời gian thu bài." },
            { status: 403 },
        );
    }

    const meResponse = await fetchCurrentUser(session, request);
    if ("error" in meResponse) {
        return NextResponse.json({ error: meResponse.error }, { status: meResponse.status });
    }

    const currentUser = meResponse.data;
    const selectedOrganization = extractOrganizations(currentUser).find(
        (organization) => String(organization.id) === organizationId,
    );

    if (!selectedOrganization) {
        return NextResponse.json({ error: "Tổ chức đã chọn không hợp lệ." }, { status: 403 });
    }

    const validation = validateSubmissionFiles(files);
    if ("error" in validation) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const effectiveSettings = getEffectiveSubmissionConfig(settings, selectedOrganization.short_name);
    if (!isSubmissionOpen(settings, selectedOrganization.short_name)) {
          return NextResponse.json(
              { error: "Tổ chức đã chọn hiện không trong thời gian thu bài." },
              { status: 403 },
          );
    }

    let result;
    try {
          result = await saveSubmission(
              currentUser,
              selectedOrganization,
              files,
              effectiveSettings.storagePrefix,
          );
    } catch {
          return NextResponse.json(
              {
                error:
                    "Không thể lưu bài nộp vào thư mục cấu hình hiện tại. Vui lòng liên hệ quản trị viên.",
            },
            { status: 500 },
        );
    }

    try {
        await insertSubmissionHistory({
            submissionId: result.submissionId,
            username: currentUser.username,
            displayName: currentUser.display_name,
            organizationId: selectedOrganization.id,
            organizationShortName: selectedOrganization.short_name,
            organizationName: selectedOrganization.name,
            fileCount: result.fileCount,
            totalBytes: result.totalBytes,
            destination: result.destination,
            savedAt: result.savedAt,
        });
    } catch {
        console.error("Failed to write submission history.");
    }

    return NextResponse.json({
        message: `Đã nhận ${result.fileCount} file cho ${currentUser.display_name} tại ${selectedOrganization.short_name}.`,
        ...result,
    });
}