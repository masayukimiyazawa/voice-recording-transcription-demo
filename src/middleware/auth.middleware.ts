/**
 * Auth middleware - session authentication check
 */

import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const session = (req as any).session;

  if (session?.authenticated) {
    return next();
  }

  const acceptsHtml = req.headers.accept?.includes('text/html');

  if (acceptsHtml) {
    res.redirect('/login');
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
