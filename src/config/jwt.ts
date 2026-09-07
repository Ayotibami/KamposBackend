import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env, REFRESH_TOKEN_EXPIRES_SECONDS } from './env';

export interface JwtClaims {
  account_id: string;
  avitag?: string; // active profile (optional until selected)
  profileType?: 'STUDENT' | 'KREATOR' | 'KOMPANY' | 'SCHOOL' | 'IDIOT' | 'king';
  role?: 'user' | 'idiot' | 'king';
  is_otp_verified?: boolean;
  // Set once, at whichever moment the active profile is chosen (switch-
  // profile) or a token is refreshed — never looked up again per-request
  // after that. School/major are one-time/immutable once a student sets
  // them (see student profile settings — there's no edit flow for either),
  // so there's no staleness risk in carrying them here the same way
  // avitag/profileType already are. Both null/absent for a non-student
  // profile (KREATOR/KOMPANY/SCHOOL/IDIOT don't have a campus at all).
  campus_tag?: string | null;
  major_tag?: string | null;
  jti?: string;
  iat?: number;
  exp?: number;
}

const REFRESH_SECRET = env.REFRESH_TOKEN_SECRET || env.JWT_SECRET;

export function signToken(payload: Omit<JwtClaims, 'iat' | 'exp'>): string {
  // jsonwebtoken rejects the call if `jti` is present both in the payload
  // and passed as the `jwtid` option — set it via the option only, never
  // spread into the payload object itself.
  const { jti: existingJti, ...rest } = payload;
  const jti = existingJti ?? randomUUID();
  return jwt.sign(rest, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_EXPIRES, jwtid: jti });
}

export function verifyToken(token: string): JwtClaims {
  return jwt.verify(token, env.JWT_SECRET) as JwtClaims;
}

// Refresh tokens carry the same identity claims but live far longer and are
// signed with a separate secret (falls back to JWT_SECRET if one isn't
// configured) — a leaked access-token-signing secret alone shouldn't be
// enough to mint new refresh tokens too.
export function signRefreshToken(payload: Omit<JwtClaims, 'iat' | 'exp'>): string {
  const { jti: existingJti, ...rest } = payload;
  const jti = existingJti ?? randomUUID();
  return jwt.sign(rest, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_SECONDS, jwtid: jti });
}

export function verifyRefreshToken(token: string): JwtClaims {
  return jwt.verify(token, REFRESH_SECRET) as JwtClaims;
}

/** A very short-lived (60s) ticket minted purely so an admin's browser can
 * authenticate a direct, cross-origin Socket.IO handshake — the real
 * session lives in an httpOnly cookie this app's own JS can never read, so
 * this is the one value the client is ever handed to prove identity for
 * that one moment. Verified with the exact same verifyToken() as a normal
 * access token (same secret, same claim shape); the short expiry — not a
 * different secret — is what limits its blast radius if it ever leaked. */
export function signSocketTicket(payload: Omit<JwtClaims, 'iat' | 'exp' | 'jti'>): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '60s' });
}
