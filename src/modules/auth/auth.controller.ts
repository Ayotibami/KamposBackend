import type { Request, Response } from "express";
import { AuthService } from "./auth.service";

export class AuthController {
  // Register user
  static async register(req: Request, res: Response) {
    const payload = req.body;
    const result = await AuthService.register(payload);
    return res.status(result.status || 201).json(result);
  }

  // Login user
  static async login(req: Request, res: Response) {
    const payload = req.body;
    const result = await AuthService.login(payload);
    return res.status(result.status || 200).json(result);
  }

  // Get user data
  static async getUser(req: Request, res: Response) {
    const userId = (req as any).user?.userId ?? req.params.id;
    const result = await AuthService.getUser(userId);
    return res.status(result.status || 200).json(result);
  }

  // Send OTP
  static async sendOTP(req: Request, res: Response) {
    const { email } = req.body;
    const result = await AuthService.sendOTP({ email });
    return res.status(result.status || 200).json(result);
  }

  // Verify OTP
  static async verifyOTP(req: Request, res: Response) {
    const { email, otp } = req.body;
    const result = await AuthService.verifyOTP({ email, otp });
    return res.status(result.status || 200).json(result);
  }

  // Forgot password
  static async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;
    const result = await AuthService.forgotPassword({ email });
    return res.status(result.status || 200).json(result);
  }

  // Reset password
  static async resetPassword(req: Request, res: Response) {
    const { email, otp, password } = req.body;
    const result = await AuthService.resetPassword({ email, otp, password });
    return res.status(result.status || 200).json(result);
  }
}
