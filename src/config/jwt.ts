import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env, REFRESH_TOKEN_EXPIRES_SECONDS } from './env';

export interface JwtClaims {
  account_id: string;
  avitag?: string; // active profile (optional until selected)
  profileType?: 'STUDENT' | 'KREATOR' | 'KOMPANY' | 'SCHOOL' | 'IDIOT' | 'king';
  role?: 'IDIOT' | 'USER' | 'king';
  who?: string;
  is_otp_verified?: boolean;
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
