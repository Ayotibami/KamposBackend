import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import * as ProfileUtils from "../profile/utils";
import { toPublicAccount } from "../account/account.repo";
import { env } from "../../config/env";
import { revokeToken, isRevoked } from "./token.service";
import { verifyRefreshToken } from "../../config/jwt";
import {
  setAuthCookies,
  clearAuthCookies,
  REFRESH_COOKIE,
} from "../../utils/authCookies";
import { safeErrorMessage, safeErrorStatus } from "../../utils/errors";

export const AuthController = {
  register: async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "email and password are required" });
    }
    try {
      const { account, accessToken, refreshToken } = await AuthService.register(
        email,
        password,
      );
      setAuthCookies(res, accessToken, refreshToken);
      return res
        .status(201)
        .json({ success: true, data: { account: toPublicAccount(account) } });
    } catch (err: any) {
      return res.status(safeErrorStatus(err)).json({
        success: false,
        message: safeErrorMessage(err, "Registration failed"),
      });
    }
  },

  login: async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "email and password are required" });
    }
    try {
      const { account, accessToken, refreshToken } = await AuthService.login(
        email,
        password,
      );
      setAuthCookies(res, accessToken, refreshToken);
      return res.json({
        success: true,
        data: { account: toPublicAccount(account) },
      });
    } catch (err: any) {
      return res
        .status(safeErrorStatus(err))
        .json({ success: false, message: safeErrorMessage(err, "Login failed") });
    }
  },

  // Silently mints a new access token (and a new refresh token) from a
  // still-valid refresh token, so a session can outlive the short
  // access-token lifetime without asking the user to log in again.
  //
  // SLIDING SESSION: a NEW refresh token is issued on every refresh, which
  // resets the 90-day clock every time the user is active. So as long as
  // the user opens the app at least once every 90 days, they never have to
  // log in again — exactly like X, Instagram, etc.
  //
  // NO REVOCATION = NO RACE: the OLD refresh token is NOT revoked here. The
  // frontend has two independent refresh paths (Next.js middleware on page
  // navigation + axios interceptor on 401 from API calls) that can fire
  // concurrently. The old code revoked the old refresh token on every call
  // (with a 10-second grace period), which meant these two paths raced each
  // other — both using the same old refresh token, both getting different
  // new tokens, and the backend revoking the old one. When the grace period
  // expired mid-race, the second request got a 401 "token revoked" which
  // cleared the cookies and logged the user out. By NOT revoking, both
  // requests succeed independently — the browser keeps whichever new token
  // arrived last, and the old one simply expires on its own.
  //
  // The refresh token is only revoked on explicit logout (see logout handler
  // below) or password change.
  refresh: async (req: Request, res: Response) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No refresh token" });
    }
    try {
      const payload = verifyRefreshToken(token);
      if (await isRevoked(payload.jti)) {
        clearAuthCookies(res);
        return res
          .status(401)
          .json({ success: false, message: "Refresh token revoked" });
      }
      const { account_id, avitag, profileType, who } = payload;
      if (!account_id) {
        clearAuthCookies(res);
        return res
          .status(401)
          .json({ success: false, message: "Invalid refresh token" });
      }
      // Both undefined (never once set, distinct from a genuine student
      // whose lookup already resolved to explicit nulls) only happens for
      // a refresh token issued before campus_tag/major_tag existed as
      // claims at all — a one-time backfill query here self-heals every
      // still-logged-in session onto the new shape the next time it
      // refreshes (every ~15 min in practice), without needing an explicit
      // re-login or profile switch. Costs one query per session, once,
      // ever — after this, campus_tag/major_tag carry forward from the
      // token on every later refresh with no query at all.
      let { campus_tag, major_tag } = payload;
      if (campus_tag === undefined && major_tag === undefined && avitag) {
        const resolved = await ProfileUtils.getCampusMajor(avitag);
        campus_tag = resolved.campus_tag;
        major_tag = resolved.major_tag;
      }
      // Re-derive role from the current admin list rather than trusting
      // whatever was baked into the old refresh token's claims — otherwise
      // someone removed from ADMIN_ACCOUNT_IDS keeps IDIOT privileges on
      // every refresh for as long as their existing session lasts (up to
      // REFRESH_TOKEN_EXPIRES_DAYS), since this endpoint would never
      // re-check. is_otp_verified is re-derived from the DB too, same
      // reasoning — issueTokenForProfile already does that part.
      const adminIds = (env.ADMIN_ACCOUNT_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const role =
        who === "king"
          ? "king"
          : adminIds.includes(account_id)
            ? "IDIOT"
            : "USER";
      // Issue a NEW access + refresh token pair. The new refresh token
      // resets the 90-day clock (sliding session). The old refresh token is
      // NOT revoked — it simply expires on its own. This is what avoids the
      // race condition that caused random logouts. campus_tag/major_tag
      // carried straight through from the old token, not re-queried — same
      // reasoning as avitag/profileType above, and see JwtClaims' own docs
      // for why that's safe (they're one-time/immutable once a student
      // sets them).
      const { accessToken, refreshToken } =
        await AuthService.issueTokenForProfile({
          account_id,
          avitag,
          profileType,
          role,
          who,
          campus_tag,
          major_tag,
        });
      setAuthCookies(res, accessToken, refreshToken);
      return res.json({ success: true, message: "Refreshed" });
    } catch (err) {
      // Token is genuinely invalid/expired — clear cookies so the client
      // knows the session is gone.
      clearAuthCookies(res);
      return res
        .status(401)
        .json({ success: false, message: "Invalid refresh token" });
    }
  },

  switchProfile: async (req: Request, res: Response) => {
    if (!req.user?.account_id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { avitag } = req.body || {};
    if (!avitag) {
      return res
        .status(400)
        .json({ success: false, message: "avitag is required" });
    }
    const profile = await ProfileUtils.findByAvitag(avitag);
    if (!profile || profile.account_id !== req.user.account_id) {
      return res.status(404).json({
        success: false,
        message: "Profile not found for this account",
      });
    }
    // if (!profile.is_verified) {
    //   return res.status(403).json({ success: false, message: 'Profile not verified yet' });
    // }

    const adminIds = (env.ADMIN_ACCOUNT_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const role = adminIds.includes(req.user.account_id) ? "IDIOT" : "USER";
    // Resolved once, here, at the moment the active profile is actually
    // chosen — not on every later feed request. No-op (both come back
    // null) for a non-student profile, which is exactly what a campus-less
    // profile type should carry. See JwtClaims' own docs for why this is
    // safe to bake into the token instead of re-querying it every time.
    const { campus_tag, major_tag } = await ProfileUtils.getCampusMajor(profile.avitag);
    // Issue a new access token with the updated profile claims. Also issue
    // a new refresh token so the refresh token's avitag/profileType claims
    // stay in sync (the refresh endpoint uses the refresh token's claims to
    // mint new access tokens). The old refresh token is NOT revoked — it
    // stays valid until it expires naturally. This avoids the race condition
    // between the middleware and axios interceptor refresh paths that caused
    // random logouts (see refresh handler above for details).
    const { accessToken, refreshToken } =
      await AuthService.issueTokenForProfile({
        account_id: req.user.account_id,
        avitag: profile.avitag,
        profileType: profile.profile_type,
        role,
        campus_tag,
        major_tag,
      });
    setAuthCookies(res, accessToken, refreshToken);

    return res.json({
      success: true,
      data: { avitag: profile.avitag, profileType: profile.profile_type },
    });
  },

  logout: async (req: Request, res: Response) => {
    // Must be authenticated to logout
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { jti, exp } = req.user;
    if (jti && exp) {
      const now = Math.floor(Date.now() / 1000);
      await revokeToken(jti, Math.max(1, exp - now));
    }
    // Also revoke the refresh token, if present, so a copy of it can't be
    // used to mint fresh access tokens after logout.
    const refreshCookie = req.cookies?.[REFRESH_COOKIE];
    if (refreshCookie) {
      try {
        const payload = verifyRefreshToken(refreshCookie);
        if (payload.jti && payload.exp) {
          const now = Math.floor(Date.now() / 1000);
          await revokeToken(payload.jti, Math.max(1, payload.exp - now));
        }
      } catch {
        // already invalid/expired — nothing to revoke
      }
    }
    clearAuthCookies(res);
    return res.json({ success: true, message: "Logged out" });
  },
};
