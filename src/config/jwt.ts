import jwt from 'jsonwebtoken';
import { env } from './env';

export interface JwtClaims {
  account_id: string;
  avitag: string; // active profile
  profileType: 'STUDENT' | 'KREATOR' | 'KOMPANY' | 'SCHOOL' | 'IDIOT';
  role?: 'IDIOT';
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JwtClaims, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES });
}

export function verifyToken(token: string): JwtClaims {
  return jwt.verify(token, env.JWT_SECRET) as JwtClaims;
}
