/**
 * Settings Repository - key-value persistence layer
 */

import { logger } from '../../shared/logger.js';
import { Setting } from './settings.model.js';

export class SettingsRepository {
  async get(key: string): Promise<string | null> {
    try {
      const setting = await Setting.findOne({ key });
      return setting?.value ?? null;
    } catch (error) {
      logger.error('Failed to get setting', { key, error });
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await Setting.findOneAndUpdate(
        { key },
        { key, value },
        { upsert: true, new: true },
      );
      logger.info('Setting updated', { key, value });
    } catch (error) {
      logger.error('Failed to set setting', { key, error });
    }
  }
}
