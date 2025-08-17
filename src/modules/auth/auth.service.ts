import crypto from "crypto";
import { ApiError, ApiSuccess } from "../../utils/responseHandler";
import { hashPassword, comparePassword } from "../../utils/validationUtils";
import { generateToken } from "../../config/token";
import { env } from "../../config/env.config";
import * as accountRepo from "../account/account.model";
import * as profileRepo from "../profile/profile.model";
import * as otpRepo from "../otp/otp.model";
import * as oauthModel from "../account/oauth.model";
import { mailService } from "../../services/mail.service";
import logger from "../../utils/logger";
import type { LoginDTO, RegisterDTO, OTPData, ResetPasswordDTO } from "./auth.interface";
import pool from "../../config/connectDB";

const REFRESH_BYTES = 64;

export class AuthService {
  static OTP_TTL_MINUTES = 10;

  // Helper: create and return { accessToken, refreshToken, session }
  private static async createSessionAndTokens(accountId: string, authProvider = "Email") {
    // generate a secure random refresh token (plain)
    const refreshTokenPlain = crypto.randomBytes(REFRESH_BYTES).toString("hex");
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

    // store hashed refresh token in DB
    const session = await oauthModel.createSession({
      accountId,
      authProvider,
      refreshTokenPlain,
      tokenExpiresAt,
    });

    // access token (JWT) payload includes accountId and sessionId
    const accessToken = generateToken({ userId: accountId, sessionId: session.session_id });

    // return tokens; send refresh token plain to client once
    return { accessToken, refreshToken: refreshTokenPlain, session };
  }

  // Register (email/password)
  static async register(userData: RegisterDTO & Partial<any>) {
    const { email, password, displayName, profileType } = userData;
    const existing = await accountRepo.findAccountByEmail(email);
    if (existing) throw ApiError.badRequest("Account with this email already exists");

    const hashed = await hashPassword(password);

    // create account
    const account = await accountRepo.createAccount({
      email,
      passwordHash: hashed,
      authProvider: "Email",
      isOtpVerified: false,
    });

    // create profile
    const profile = await profileRepo.createProfile({
      accountId: account.accountId!,
      displayName: displayName ?? "",
      profileType: (profileType as any) ?? "STUDENT",
    });

    // send OTP
    const emailInfo = await mailService.sendOTPViaEmail(email, displayName ?? "");

    // respond
    (account as any).passwordHash = undefined;
    return ApiSuccess.created(`Registration successful, OTP sent to ${emailInfo.envelope.to}`, { account, profile });
  }

  // Login (email/password) -> issues access + refresh tokens and a session
  static async login(userData: LoginDTO) {
    const { email, password } = userData;
    const account = await accountRepo.findAccountByEmail(email);
    if (!account) throw ApiError.notFound("Invalid credentials");
    if (!account.passwordHash) throw ApiError.forbidden("No password set for this account");

    await comparePassword(password, account.passwordHash);

    if (!account.isOtpVerified) throw ApiError.forbidden("Email not verified");

    const { accessToken, refreshToken, session } = await AuthService.createSessionAndTokens(account.accountId!);

    return ApiSuccess.ok("Login successful", {
      accessToken,
      refreshToken,
      expiresIn: Number(env.JWT_EXPIRES) || 86400,
      sessionId: session.session_id,
      account: { email: account.email, accountId: account.accountId },
    });
  }

  // OAuth sign-in/up (providerId: provider, oauthId: provider unique id, profileData optional)
  static async oauthLogin(provider: string | undefined, oauthId: string, profileData: { email?: string; displayName?: string } = {}) {
    // find account by oauth_id
    let account = await accountRepo.findAccountByOauthId(oauthId);
    if (!account) {
      // create account if not exists (oauth user)
      account = await accountRepo.createAccount({
        email: profileData.email ?? `${oauthId}@${provider}.local`,
        passwordHash: null,
        authProvider: provider as any,
        isOtpVerified: true, // consider provider verified
        oauthId,
      });
      await profileRepo.createProfile({
        accountId: account.accountId!,
        displayName: profileData.displayName ?? "",
        profileType: "STUDENT",
      });
    }

    const { accessToken, refreshToken, session } = await AuthService.createSessionAndTokens(account.accountId!, provider);

    return ApiSuccess.ok("OAuth login successful", { accessToken, refreshToken, sessionId: session.session_id });
  }

  // Exchange refresh token for new access token
  static async refreshTokens(refreshToken: string) {
    // find session by hashed token
    const session = await oauthModel.findSessionByRefreshToken(refreshToken);
    if (!session) throw ApiError.unauthorized("Invalid refresh token");

    // check expiry
    if (session.token_expires_at && new Date(session.token_expires_at) < new Date()) {
      // session expired -> delete
      await oauthModel.deleteSessionById(session.session_id);
      throw ApiError.unauthorized("Refresh token expired");
    }

    // create new access token (and optional rotate refresh token)
    const accessToken = generateToken({ userId: session.account_id, sessionId: session.session_id });

    // optionally rotate refresh token: generate new, update session encrypted_refresh_token
    const newRefreshPlain = crypto.randomBytes(REFRESH_BYTES).toString("hex");
    const hashed = crypto.createHash("sha256").update(newRefreshPlain).digest("hex");
    await pool.query(
      `UPDATE oauth_sessions SET encrypted_refresh_token = $1, updated_at = now() WHERE session_id = $2`,
      [hashed, session.session_id]
    );

    return ApiSuccess.ok("Tokens refreshed", { accessToken, refreshToken: newRefreshPlain, expiresIn: Number(env.JWT_EXPIRES) || 86400 });
  }

  // Logout: revoke session by id or refresh token
  static async logout({ sessionId, refreshToken }: { sessionId?: string; refreshToken?: string }) {
    if (sessionId) {
      await oauthModel.deleteSessionById(sessionId);
      return ApiSuccess.ok("Logged out");
    }
    if (refreshToken) {
      const session = await oauthModel.findSessionByRefreshToken(refreshToken);
      if (session && session.session_id) await oauthModel.deleteSessionById(session.session_id);
      return ApiSuccess.ok("Logged out");
    }
    throw ApiError.badRequest("sessionId or refreshToken required");
  }

  // Get user details (account + profile)
  static async getUser(userId: string | number) {
    const id = String(userId);
    const account = await accountRepo.findAccountById(id);
    if (!account) throw ApiError.notFound("User not found");
    (account as any).passwordHash = undefined;
    const profile = await profileRepo.findProfileByAccountId(account.accountId!);
    return ApiSuccess.ok("User fetched", { account, profile });
  }

  // Send / verify / forgot / reset OTP unchanged (reuse existing implementations)
  static async sendOTP({ email }: { email: string }) {
    const account = await accountRepo.findAccountByEmail(email);
    if (!account) throw ApiError.notFound("Account not found");
    if (account.isOtpVerified) return ApiSuccess.ok("Already verified");
    const info = await mailService.sendOTPViaEmail(email, "");
    return ApiSuccess.ok(`OTP sent to ${info.envelope.to}`);
  }

  static async verifyOTP({ email, otp }: OTPData) {
    const account = await accountRepo.findAccountByEmail(email);
    if (!account) throw ApiError.notFound("Account not found");
    if (account.isOtpVerified) return ApiSuccess.ok("Already verified");
    const latest = await otpRepo.findOTPByEmail(email);
    if (!latest || latest.otp !== otp) throw ApiError.badRequest("Invalid or expired OTP");
    const created = new Date(latest.createdAt!);
    const minutes = (Date.now() - created.getTime()) / 1000 / 60;
    if (minutes > AuthService.OTP_TTL_MINUTES) throw ApiError.badRequest("OTP expired");
    await accountRepo.updateAccountById(account.accountId!, { isOtpVerified: true });
    if (latest.id) await otpRepo.deleteOTPById(latest.id);
    return ApiSuccess.ok("Email verified");
  }

  static async forgotPassword({ email }: { email: string }) {
    const account = await accountRepo.findAccountByEmail(email);
    if (!account) throw ApiError.notFound("Account not found");
    const info = await mailService.sendOTPViaEmail(email, "");
    return ApiSuccess.ok(`OTP sent to ${info.envelope.to}`);
  }

  static async resetPassword({ email, otp, password }: ResetPasswordDTO) {
    const account = await accountRepo.findAccountByEmail(email);
    if (!account) throw ApiError.notFound("Account not found");
    const latest = await otpRepo.findOTPByEmail(email);
    if (!latest || latest.otp !== otp) throw ApiError.badRequest("Invalid or expired OTP");
    const created = new Date(latest.createdAt!);
    const minutes = (Date.now() - created.getTime()) / 1000 / 60;
    if (minutes > AuthService.OTP_TTL_MINUTES) throw ApiError.badRequest("OTP expired");
    const hashed = await hashPassword(password);
    await accountRepo.updateAccountById(account.accountId!, { passwordHash: hashed });
    if (latest.id) await otpRepo.deleteOTPById(latest.id);
    return ApiSuccess.ok("Password updated");
  }

  // Account operations
  static async changePassword(accountId: string, oldPassword: string, newPassword: string) {
    const account = await accountRepo.findAccountById(accountId);
    if (!account) throw ApiError.notFound("Account not found");
    if (!account.passwordHash) throw ApiError.badRequest("No password set for this account");
    await comparePassword(oldPassword, account.passwordHash);
    const hashed = await hashPassword(newPassword);
    await accountRepo.updateAccountById(accountId, { passwordHash: hashed });
    // revoke all sessions on password change
    await oauthModel.deleteSessionsByAccountId(accountId);
    return ApiSuccess.ok("Password changed; sessions revoked");
  }

  static async updateAccount(accountId: string, updates: Record<string, any>) {
    const updated = await accountRepo.updateAccountById(accountId, updates);
    if (!updated) throw ApiError.notFound("Account not found");
    return ApiSuccess.ok("Account updated", { account: updated });
  }

  static async softDeleteAccount(accountId: string) {
    await accountRepo.updateAccountById(accountId, { accountStatus: "Deleted" });
    // revoke sessions
    await oauthModel.deleteSessionsByAccountId(accountId);
    return ApiSuccess.ok("Account deactivated");
  }
}

export const authService = AuthService;
