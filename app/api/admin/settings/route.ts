import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/auth";
import { fetchCurrentUser } from "@/app/lib/judge-api";
import { loadSettings, saveSettings, type AppSettings } from "@/app/lib/settings";

type AdminAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

async function requireSuperuser(request: Request) {
  const session = await getSession();
  if (!session) {
    return { ok: false, status: 401, error: "Phiên đăng nhập đã hết hạn." } satisfies AdminAuthResult;
  }

  const meResult = await fetchCurrentUser(session, request);
  if ("error" in meResult) {
    return {
      ok: false,
      status: meResult.status,
      error: meResult.error ?? "Không thể xác thực người dùng.",
    } satisfies AdminAuthResult;
  }

  if (!meResult.data.is_superuser) {
    return { ok: false, status: 403, error: "Không có quyền truy cập." } satisfies AdminAuthResult;
  }

  return { ok: true } satisfies AdminAuthResult;
}

export async function GET(request: Request) {
  const auth = await requireSuperuser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const settings = await loadSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  const auth = await requireSuperuser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as Partial<AppSettings> | null;
  if (!body) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const current = await loadSettings();
  const updated: AppSettings = {
    submissionStart: "submissionStart" in body ? (body.submissionStart ?? null) : current.submissionStart,
    submissionEnd: "submissionEnd" in body ? (body.submissionEnd ?? null) : current.submissionEnd,
    storagePrefix: body.storagePrefix?.trim() || current.storagePrefix,
  };

  await saveSettings(updated);
  return NextResponse.json(updated);
}
