/**
 * Portal Controller - login, logout, dashboard routes
 */

import { Request, Response } from 'express';
import { PortalService } from './portal.service.js';
import { ValidationError } from '../../shared/error.handler.js';
import { logger } from '../../shared/logger.js';

export class PortalController {
  constructor(private portalService: PortalService) {}

  async login(req: Request, res: Response): Promise<void> {
    const { password } = req.body;

    if (!password) {
      throw new ValidationError('Password is required');
    }

    const isValid = await this.portalService.validatePassword(password);

    if (!isValid) {
      logger.warn('Invalid login attempt');
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    (req as any).session.authenticated = true;
    logger.info('User logged in successfully');
    res.redirect('/dashboard');
  }

  async logout(req: Request, res: Response): Promise<void> {
    (req as any).session.destroy((err: any) => {
      if (err) {
        logger.error('Session destroy failed', err);
      }
      res.redirect('/login');
    });
  }

  renderLogin(_req: Request, res: Response): void {
    res.render('login');
  }
}
