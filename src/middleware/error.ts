import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

export const notFound = (req: Request, res: Response) => {
  return res.status(404).json({ success: false, message: 'Not Found' });
};

export const errorHandler: ErrorRequestHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  return res.status(status).json({ success: false, message });
};
