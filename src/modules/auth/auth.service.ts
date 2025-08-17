import User from "../user/user.model.js";
import OTP from "../otp/otp.model.js";
import type {
  LoginDTO,
  OTPData,
  RegisterDTO,
  ResetPasswordDTO,
} from "./auth.interface.js";
import UserService from "../user/user.service.js";
import { comparePassword, hashPassword } from "../../utils/validationUtils.js";
import { ApiError, ApiSuccess } from "../../utils/responseHandler.js";
import { generateToken } from "../../config/token.js";
import logger from "../../utils/logger.js";
import { mailService } from "../../services/mail.service.js";
import type { ObjectId } from "mongoose";

export class AuthService {
  static async register(userData: RegisterDTO) {
    const { password, email } = userData;

    await UserService.checkIfUserExists(email);

    console.log({ userData });

    const hashedPassword = await hashPassword(password);

    console.log({ hashedPassword });

    const user = new User({ email, password: hashedPassword });

    const emailInfo = await mailService.sendOTPViaEmail(
      user.email,
      "-"
      // user.firstName
    );

    await user.save();

    user.password = undefined;

    console.log({ emailInfo });
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
    const token = generateToken({ userId: user._id });

    return ApiSuccess.ok("Login Successful", {
      user: { email: user.email, id: user._id },
      token,
    });
  }

  static async getUser(userId: ObjectId) {
    const user = await UserService.findUserById(userId);
    user.password = undefined;
    return ApiSuccess.ok("User Retrieved Successfully", {
      user,
    });
  }

  static async sendOTP({ email }: { email: string }) {
    const user = await UserService.findUserByEmail(email);
    if (user.isVerified) {
      return ApiSuccess.ok("User Already Verified");
    }

    const emailInfo = await mailService.sendOTPViaEmail(
      user.email,
      ""
      //   user.firstName
    );

    return ApiSuccess.ok(`OTP has been sent to ${emailInfo.envelope.to}`);
  }

  static async verifyOTP({ email, otp }: OTPData) {
    const user = await UserService.findUserByEmail(email);
    if (user.isVerified) {
      return ApiSuccess.ok("User Already Verified");
    }
    const otpExists = await OTP.findOne({ email, otp });
    if (!otpExists) {
      throw ApiError.badRequest("Invalid or Expired OTP");
    }
    user.isVerified = true;
    await user.save();
    return ApiSuccess.ok("Email Verified");
  }

  static async forgotPassword({ email }: { email: string }) {
    const userProfile = await UserService.findUserByEmail(email);
    const emailInfo = await mailService.sendOTPViaEmail(userProfile.email, "");
    return ApiSuccess.ok(`OTP has been sent to ${emailInfo.envelope.to}`);
  }

  static async resetPassword({ email, otp, password }: ResetPasswordDTO) {
    const user = await UserService.findUserByEmail(email);
    const otpExists = await OTP.findOne({ email, otp });
    if (!otpExists) {
      throw ApiError.badRequest("Invalid or Expired OTP");
    }
    user.password = await hashPassword(password);
    await user.save();
    return ApiSuccess.ok("Password Updated");
  }
}

export const authService = new AuthService();
