import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { verifyGoogleIdToken } from "./google.provider.ts"; // new

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

  // Refresh token
  static async refreshToken(req: Request, res: Response) {
    const { refreshToken } = req.body;
    const result = await AuthService.refreshTokens(refreshToken);
    return res.status(result.status || 200).json(result);
  }

  // Logout user
  static async logout(req: Request, res: Response) {
    const sessionId = (req as any).user?.sessionId;
    // Accept either sessionId (from token) or refreshToken in body
    const { refreshToken } = req.body;
    const result = await AuthService.logout({ sessionId, refreshToken });
    return res.status(result.status || 200).json(result);
  }

  // oauth handler (server-side exchange of provider token -> create/find account)
  static async oauthHandler(req: Request, res: Response) {
    const provider = (req.params.provider || "").toLowerCase();
    try {
      if (provider === "google") {
        const { idToken } = req.body; // client sends Google id_token
        if (!idToken) return res.status(400).json({ message: "idToken required" });
        const payload = await verifyGoogleIdToken(idToken);
        // payload.sub is the provider unique id
        const result = await AuthService.oauthLogin("Google", payload.sub, {
          email: payload.email,
          displayName: payload.name,
        });
        return res.status(result.status || 200).json(result);
      }

      // fallback: accept direct oauthId/email/displayName in body for other providers
      const { oauthId, email, displayName } = req.body;
      const result = await AuthService.oauthLogin(provider, oauthId, { email, displayName });
      return res.status(result.status || 200).json(result);
    } catch (err: any) {
      return res.status(err?.status || 500).json({ message: err?.message || "OAuth error" });
    }
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

  // Account actions (authenticated)
  static async changePassword(req: Request, res: Response) {
    const accountId = (req as any).user?.userId;
    const { oldPassword, newPassword } = req.body;
    const result = await AuthService.changePassword(accountId, oldPassword, newPassword);
    return res.status(result.status || 200).json(result);
  }

  static async updateAccount(req: Request, res: Response) {
    const accountId = (req as any).user?.userId;
    const updates = req.body;
    const result = await AuthService.updateAccount(accountId, updates);
    return res.status(result.status || 200).json(result);
  }

  static async softDeleteAccount(req: Request, res: Response) {
    const accountId = (req as any).user?.userId;
    const result = await AuthService.softDeleteAccount(accountId);
    return res.status(result.status || 200).json(result);
  }
}
