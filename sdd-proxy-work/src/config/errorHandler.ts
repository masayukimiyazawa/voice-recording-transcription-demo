import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/error';
import { logger } from '../config/logger';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    logger.error(`AppError: ${err.message}`, { statusCode: err.statusCode });
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    });
  }

  logger.error(`UnhandledError: ${err.message}`, { stack: err.stack });
  return res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
  });
};
