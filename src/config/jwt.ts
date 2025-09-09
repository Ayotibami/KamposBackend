import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from './env';

export interface JwtClaims {
  account_id: string;
  avitag?: string; // active profile (optional until selected)
  profileType?: 'STUDENT' | 'KREATOR' | 'KOMPANY' | 'SCHOOL' | 'IDIOT';
  role?: 'IDIOT';
  jti?: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JwtClaims, 'iat' | 'exp'>): string {
  const jti = randomUUID();
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES, jwtid: jti });
}

export function verifyToken(token: string): JwtClaims {
  return jwt.verify(token, env.JWT_SECRET) as JwtClaims;
}
