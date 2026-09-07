import { afterEach, describe, expect, it, vi } from "vitest";

async function importAuthModule() {
  vi.resetModules();
  return import("@/app/lib/auth");
}

describe("auth helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("validates login input", async () => {
    const { validateLoginInput } = await importAuthModule();

    expect(validateLoginInput({ username: "", password: "abc" })).toEqual({
      error: "Vui lòng nhập tài khoản.",
    });
    expect(validateLoginInput({ username: "student", password: "" })).toEqual({
      error: "Vui lòng nhập mật khẩu.",
    });
    expect(validateLoginInput({ username: "  Nguyen  Van  A ", password: "secret" })).toEqual({
      username: "Nguyen Van A",
      password: "secret",
    });
  });

  it("uses strict cookies in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "prod-secret");

    const { getSessionCookieOptions } = await importAuthModule();
    expect(getSessionCookieOptions(3600)).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      path: "/",
      priority: "high",
      maxAge: 3600,
    });
  });

  it("uses lax cookies in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SESSION_SECRET", "dev-secret");

    const { getSessionCookieOptions } = await importAuthModule();
    expect(getSessionCookieOptions(3600)).toMatchObject({
      sameSite: "lax",
      secure: false,
    });
  });
});
