import "server-only";

import { NextResponse } from "next/server";

import { getSession } from "@/app/lib/auth";
import { fetchCurrentUser } from "@/app/lib/judge-api";

type AdminAuthResult =
  | { ok: true }
  | { ok: false; response: NextResponse<{ error: string }> };

export async function requireSuperuser(request: Request): Promise<AdminAuthResult> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Phiên đăng nhập đã hết hạn." },
        { status: 401 },
      ),
    };
  }

  const meResult = await fetchCurrentUser(session, request);
  if ("error" in meResult) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: meResult.error ?? "Không thể xác thực người dùng." },
        { status: meResult.status },
      ),
    };
  }

  if (!meResult.data.is_superuser) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Không có quyền truy cập." }, { status: 403 }),
    };
  }

  return { ok: true };
}
