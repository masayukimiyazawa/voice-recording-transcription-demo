/**
 * Portal Controller - login, logout, dashboard routes
 */

import { Request, Response } from 'express';
import { PortalService } from './portal.service.js';
import { SettingsRepository } from '../settings/settings.repository.js';
import { ValidationError } from '../../shared/error.handler.js';
import { logger } from '../../shared/logger.js';

const LANGUAGE_SETTING_KEY = 'language';

export class PortalController {
  constructor(
    private portalService: PortalService,
    private settingsRepository: SettingsRepository,
  ) {}

  async login(req: Request, res: Response): Promise<void> {
    const { password, language } = req.body;

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
    // ログイン時に言語設定をセッションに保存
    // 'ja' が選択された場合は 'ja-JP' に変換
    const sessionLanguage = language === 'ja' ? 'ja-JP' : 'en-US';
    (req as any).session.language = sessionLanguage;
    // DB にも保存（Vonage webhook からも参照できるように）
    await this.settingsRepository.set(LANGUAGE_SETTING_KEY, sessionLanguage);
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

  /**
   * Update session language (called from dashboard when UI language changes)
   * PUT /api/language
   */
  async updateLanguage(req: Request, res: Response): Promise<void> {
    const { language } = req.body;

    if (language !== 'ja' && language !== 'en') {
      res.status(400).json({ error: 'Invalid language. Must be "ja" or "en".' });
      return;
    }

    const sessionLanguage = language === 'ja' ? 'ja-JP' : 'en-US';
    (req as any).session.language = sessionLanguage;
    // DB にも保存
    await this.settingsRepository.set(LANGUAGE_SETTING_KEY, sessionLanguage);
    logger.info('Session language updated', { language: sessionLanguage });

    res.json({ ok: true, language: sessionLanguage });
  }

  renderLogin(_req: Request, res: Response): void {
    res.render('login');
  }
}
