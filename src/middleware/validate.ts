import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

export const validateBody = (schema: ZodSchema<any>) => (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err: any) {
    const issues = err?.issues || [];
    return res.status(400).json({ success: false, message: 'Validation error', errors: issues });
  }
};
