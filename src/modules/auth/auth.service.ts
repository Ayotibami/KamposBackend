import type {
  LoginDTO,
  OTPData,
  RegisterDTO,
  ResetPasswordDTO,
} from "./auth.interface";
import UserService from "../user/user.service";
import { comparePassword, hashPassword } from "../../utils/validationUtils";
import { ApiError, ApiSuccess } from "../../utils/responseHandler";
import { generateToken } from "../../config/token";
import logger from "../../utils/logger";
import { mailService } from "../../services/mail.service";
import * as otpRepo from "../otp/otp.model";
import * as userRepo from "../user/user.model";

export class AuthService {
  static async register(userData: RegisterDTO & Partial<any>) {
    const { password, email } = userData;

    await UserService.checkIfUserExists(email);

    const hashedPassword = await hashPassword(password);

    const user = await UserService.createUser({ ...userData, password: hashedPassword });

    // send OTP after creating user
    const emailInfo = await mailService.sendOTPViaEmail(user.email, user.userName ?? "-");

    // do not return password
    (user as any).password = undefined;

    return ApiSuccess.created(
      `Registration Successful, OTP has been sent to ${emailInfo.envelope.to}`,
      { user }
    );
  }

  static async login(userData: LoginDTO) {
    const { email, password } = userData;
    const user = await UserService.findUserByEmail(email);
    await comparePassword(password, user.password as string);

    if (!user.isVerified) {
      throw ApiError.forbidden("Email Not Verified");
    }
    const token = generateToken({ userId: user.id });

    return ApiSuccess.ok("Login Successful", {
      user: { email: user.email, id: user.id },
      token,
    });
  }

  static async getUser(userId: number | string) {
    const user = await UserService.findUserById(userId);
    // hide password
    (user as any).password = undefined;
    return ApiSuccess.ok("User Retrieved Successfully", {
      user,
    });
  }

  static async sendOTP({ email }: { email: string }) {
    const user = await UserService.findUserByEmail(email);
    if (user.isVerified) {
      return ApiSuccess.ok("User Already Verified");
    }

    const emailInfo = await mailService.sendOTPViaEmail(user.email, user.userName ?? "");
    return ApiSuccess.ok(`OTP has been sent to ${emailInfo.envelope.to}`);
  }

  static async verifyOTP({ email, otp }: OTPData) {
    const user = await UserService.findUserByEmail(email);
    if (user.isVerified) {
      return ApiSuccess.ok("User Already Verified");
    }

    const latest = await otpRepo.findOTPByEmail(email);
    if (!latest || latest.otp !== otp) {
      throw ApiError.badRequest("Invalid or Expired OTP");
    }

    // mark user verified and delete used otp
    await userRepo.updateUserById(user.id as number, { isVerified: true });
    if (latest.id) await otpRepo.deleteOTPById(latest.id);

    return ApiSuccess.ok("Email Verified");
  }

  static async forgotPassword({ email }: { email: string }) {
    const userProfile = await UserService.findUserByEmail(email);
    const emailInfo = await mailService.sendOTPViaEmail(userProfile.email, userProfile.userName ?? "");
    return ApiSuccess.ok(`OTP has been sent to ${emailInfo.envelope.to}`);
  }

  static async resetPassword({ email, otp, password }: ResetPasswordDTO) {
    const user = await UserService.findUserByEmail(email);
    const latest = await otpRepo.findOTPByEmail(email);
    if (!latest || latest.otp !== otp) {
      throw ApiError.badRequest("Invalid or Expired OTP");
    }

    const hashed = await hashPassword(password);
    await userRepo.updateUserById(user.id as number, { password: hashed });
    if (latest.id) await otpRepo.deleteOTPById(latest.id);

    return ApiSuccess.ok("Password Updated");
  }
}

export const authService = new AuthService();
