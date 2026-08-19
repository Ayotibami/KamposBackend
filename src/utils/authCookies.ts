import type { Response } from "express";
import { env, REFRESH_TOKEN_EXPIRES_SECONDS } from "../config/env";

export const ACCESS_COOKIE = "kampos_at";
export const REFRESH_COOKIE = "kampos_rt";

// httpOnly so no client-side JS can ever read the token (defeats XSS token
// theft) — the browser just sends it automatically on every request to the
// API origin. In production the frontend and backend live on different
// domains, which is genuinely cross-site, so the cookie needs
// SameSite=None (+ Secure, required alongside None). In local dev both run
// on `localhost` (different ports only), which counts as the same site, so
// SameSite=Lax works there without needing HTTPS.
const isProd = env.NODE_ENV === "production";
const baseOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/",
};

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseOptions,
    maxAge: env.ACCESS_TOKEN_EXPIRES * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseOptions,
    maxAge: REFRESH_TOKEN_EXPIRES_SECONDS * 1000,
  });
}

/** Sets only the short-lived access token cookie, leaving the refresh token
 *  cookie untouched. Used by the refresh endpoint which mints a new access
 *  token on every call but keeps the same refresh token for its full
 *  lifetime (no rotation — see auth.controller.ts refresh handler). */
export function setAccessTokenCookie(res: Response, accessToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseOptions,
    maxAge: env.ACCESS_TOKEN_EXPIRES * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, baseOptions);
  res.clearCookie(REFRESH_COOKIE, baseOptions);
}
