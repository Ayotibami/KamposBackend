import type { LoginDTO, OTPData, RegisterDTO, ResetPasswordDTO } from "./auth.interface";
import { ApiError, ApiSuccess } from "../../utils/responseHandler";
import { hashPassword, comparePassword } from "../../utils/validationUtils";
import { generateToken } from "../../config/token";
import * as accountRepo from "../account/account.model";
import * as profileRepo from "../profile/profile.model";
import * as otpRepo from "../otp/otp.model";
import { mailService } from "../../services/mail.service";
import logger from "../../utils/logger";

export class AuthService {
  static OTP_TTL_MINUTES = 10; // adjust as needed

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

    // create a bare profile
    const profile = await profileRepo.createProfile({
      accountId: account.accountId,
      displayName: displayName ?? "",
      profileType: (profileType as any) ?? "STUDENT",
    });

    // send OTP to email
    const emailInfo = await mailService.sendOTPViaEmail(email, displayName ?? "");

    // hide sensitive
    (account as any).passwordHash = undefined;

    return ApiSuccess.created(`Registration successful, OTP sent to ${emailInfo.envelope.to}`, {
      account,
      profile,
    });
  }

  static async login(userData: LoginDTO) {
    const { email, password } = userData;
    const account = await accountRepo.findAccountByEmail(email);
    if (!account) throw ApiError.notFound("Invalid credentials");
    if (!account.passwordHash) throw ApiError.forbidden("No password set for this account");

    await comparePassword(password, account.passwordHash);

    if (!account.isOtpVerified) throw ApiError.forbidden("Email not verified");

    // generate token (payload contains accountId)
    const token = generateToken({ userId: account.accountId });

    return ApiSuccess.ok("Login successful", { token, account: { email: account.email, accountId: account.accountId } });
  }

  static async getUser(userId: string | number) {
    const id = String(userId);
    const account = await accountRepo.findAccountById(id);
    if (!account) throw ApiError.notFound("User not found");
    (account as any).passwordHash = undefined;
    const profile = await profileRepo.findProfileByAccountId(account.accountId!);
    return ApiSuccess.ok("User fetched", { account, profile });
  }

  static async sendOTP({ email }: { email: string }) {
    const account = await accountRepo.findAccountByEmail(email);
    if (!account) throw ApiError.notFound("Account not found");
    if (account.isOtpVerified) return ApiSuccess.ok("User already verified");
    const info = await mailService.sendOTPViaEmail(email, "");
    return ApiSuccess.ok(`OTP sent to ${info.envelope.to}`);
  }

  static async verifyOTP({ email, otp }: OTPData) {
    const account = await accountRepo.findAccountByEmail(email);
    if (!account) throw ApiError.notFound("Account not found");
    if (account.isOtpVerified) return ApiSuccess.ok("Already verified");

    const latest = await otpRepo.findOTPByEmail(email);
    if (!latest || latest.otp !== otp) throw ApiError.badRequest("Invalid or expired OTP");

    // check TTL
    const created = new Date(latest.createdAt!);
    const minutes = (Date.now() - created.getTime()) / 1000 / 60;
    if (minutes > AuthService.OTP_TTL_MINUTES) {
      throw ApiError.badRequest("OTP expired");
    }

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

    // TTL check
    const created = new Date(latest.createdAt!);
    const minutes = (Date.now() - created.getTime()) / 1000 / 60;
    if (minutes > AuthService.OTP_TTL_MINUTES) throw ApiError.badRequest("OTP expired");

    const hashed = await hashPassword(password);
    await accountRepo.updateAccountById(account.accountId!, { passwordHash: hashed });
    if (latest.id) await otpRepo.deleteOTPById(latest.id);

    return ApiSuccess.ok("Password updated");
  }
}

export const authService = new AuthService();
