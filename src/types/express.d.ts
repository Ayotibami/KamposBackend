import 'express';
import type { JwtClaims } from '../config/jwt';

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtClaims;
  }
}
