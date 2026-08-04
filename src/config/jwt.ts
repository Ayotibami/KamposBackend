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
  const jti = payload.jti ?? randomUUID();
  return jwt.sign({ ...payload, jti }, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_EXPIRES, jwtid: jti });
}

export function verifyToken(token: string): JwtClaims {
  return jwt.verify(token, env.JWT_SECRET) as JwtClaims;
}

// Refresh tokens carry the same identity claims but live far longer and are
// signed with a separate secret (falls back to JWT_SECRET if one isn't
// configured) — a leaked access-token-signing secret alone shouldn't be
// enough to mint new refresh tokens too.
export function signRefreshToken(payload: Omit<JwtClaims, 'iat' | 'exp'>): string {
  const jti = payload.jti ?? randomUUID();
  return jwt.sign({ ...payload, jti }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_SECONDS, jwtid: jti });
}

export function verifyRefreshToken(token: string): JwtClaims {
  return jwt.verify(token, REFRESH_SECRET) as JwtClaims;
}
