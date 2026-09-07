import { NextResponse } from "next/server";

import { requireSuperuser } from "@/app/lib/admin-auth";
import { jsonError, parseJsonBody, withRouteErrorHandling } from "@/app/lib/api-utils";
import { loadSettings, saveSettings, type AppSettings } from "@/app/lib/settings";

export async function GET(request: Request) {
  return withRouteErrorHandling("admin.settings.get", async () => {
    const auth = await requireSuperuser(request);
    if (!auth.ok) {
      return auth.response;
    }

    const settings = await loadSettings();
    return NextResponse.json(settings);
  });
}

export async function POST(request: Request) {
  return withRouteErrorHandling("admin.settings.post", async () => {
    const auth = await requireSuperuser(request);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await parseJsonBody<Partial<AppSettings>>(request);
    if (!body) {
      return jsonError("Dữ liệu không hợp lệ.", 400);
    }

    const current = await loadSettings();
    const updated: AppSettings = {
      submissionStart: "submissionStart" in body ? (body.submissionStart ?? null) : current.submissionStart,
      submissionEnd: "submissionEnd" in body ? (body.submissionEnd ?? null) : current.submissionEnd,
      storagePrefix: body.storagePrefix?.trim() || current.storagePrefix,
    };

    await saveSettings(updated);
    return NextResponse.json(updated);
  });
}
