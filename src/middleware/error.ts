import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import logger from '../utils/logger';

export const notFound = (req: Request, res: Response) => {
  return res.status(404).json({ success: false, message: 'Not Found' });
};

// A generic, safe message for anything that reaches this handler. Every
// controller in this codebase that has a genuine, curated, user-facing
// error already sends its own res.status(...).json({ message }) directly —
// grep confirms nothing anywhere throws an error with an intentional
// .statusCode set for this handler to trust. That means everything that
// actually lands here is, by construction, an UNEXPECTED failure: an
// unhandled promise rejection from a service/repo, most commonly a raw `pg`
// driver error ("duplicate key value violates unique constraint...",
// "relation \"gists\" does not exist", connection resets, etc.), sometimes
// a third-party API failure or a plain bug. `err.message` on those is
// internal/technical by nature — it was never written for a user to read —
// so it used to go straight into the API response and the frontend showed
// it verbatim (apiErrorMessage prefers response.data.message over its own
// caller-supplied fallback, so whatever this handler sends wins). Logging
// the real error here (full detail, server-side only) and always replying
// with one safe, friendly line closes that leak without needing every
// service/repo in the app to be individually audited for what it might
// throw — new unexpected failures are covered automatically too.
const GENERIC_MESSAGE = 'Something went wrong on our end. Please try again in a moment.';

export const errorHandler: ErrorRequestHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  logger.error({ err, path: req.originalUrl, method: req.method }, 'Unhandled error reached errorHandler');
  return res.status(status).json({ success: false, message: GENERIC_MESSAGE });
};
