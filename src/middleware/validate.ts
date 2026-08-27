import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import logger from '../utils/logger';

export const validateBody = (schema: ZodSchema<any>) => (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err: any) {
    // The raw zod issues array (field paths, "expected"/"received" types,
    // internal codes) is genuinely useful for debugging but not something a
    // client should ever see verbatim — logged here instead of on the
    // response, same reasoning as errorHandler's GENERIC_MESSAGE.
    logger.warn({ issues: err?.issues, path: req.originalUrl }, 'Request body failed validation');
    return res.status(400).json({ success: false, message: 'Some of that information isn\'t quite right — please check and try again.' });
  }
};
