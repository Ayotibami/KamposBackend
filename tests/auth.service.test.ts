import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "../src/modules/auth/auth.service";

vi.mock("../src/modules/account/account.model", () => ({
  findAccountByEmail: vi.fn(),
  findAccountById: vi.fn(),
  createAccount: vi.fn(),
  updateAccountById: vi.fn(),
}));
vi.mock("../src/modules/profile/profile.model", () => ({
  findProfileByAccountId: vi.fn(),
  createProfile: vi.fn(),
  updateProfileByAvitag: vi.fn(),
}));
vi.mock("../src/modules/otp/otp.model", () => ({
  findOTPByEmail: vi.fn(),
  deleteOTPById: vi.fn(),
}));
vi.mock("../src/modules/account/oauth.model", () => ({
  createSession: vi.fn(),
  deleteSessionsByAccountId: vi.fn(),
  deleteSessionById: vi.fn(),
  findSessionByRefreshToken: vi.fn(),
}));
vi.mock("../src/services/mail.service", () => ({
  mailService: { sendOTPViaEmail: vi.fn() },
}));
vi.mock("../src/services/redis.service", () => ({
  cacheUserSession: vi.fn(),
  getCachedUserSession: vi.fn(),
}));
vi.mock("../src/config/token", () => ({
  generateToken: vi.fn(() => "access-token-123"),
}));
vi.mock("../src/utils/validationUtils", () => ({
  hashPassword: vi.fn(async (p:string)=>`hashed:${p}`),
  comparePassword: vi.fn(async ()=>true),
}));

import * as accountRepo from "../src/modules/account/account.model";
import * as profileRepo from "../src/modules/profile/profile.model";
import * as oauthModel from "../src/modules/account/oauth.model";
import * as redisSvc from "../src/services/redis.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthService.login", () => {
  it("returns access and refresh tokens when credentials are valid and OTP verified", async () => {
    (accountRepo.findAccountByEmail as any).mockResolvedValue({
      accountId: "acc-1",
      email: "user@example.com",
      passwordHash: "hashed:secret",
      isOtpVerified: true,
    });
    (profileRepo.findProfileByAccountId as any).mockResolvedValue({ avitag: "avi-1" });
    (redisSvc.getCachedUserSession as any).mockResolvedValue(null);
    (oauthModel.createSession as any).mockResolvedValue({ session_id: "sess-1" });

    const res = await AuthService.login({ email: "user@example.com", password: "secret" });

    expect(res.success).toBe(true);
    expect(res.data.accessToken).toBe("access-token-123");
    expect(res.data.refreshToken).toBeDefined();
    expect(res.data.sessionId).toBe("sess-1");
  });
});
