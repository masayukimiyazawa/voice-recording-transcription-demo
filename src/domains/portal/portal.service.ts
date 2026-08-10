/**
 * Portal Service - authentication and session logic
 */

import bcrypt from 'bcrypt';
import { config } from '../../shared/config.js';
import { logger } from '../../shared/logger.js';

export class PortalService {
  async validatePassword(inputPassword: string): Promise<boolean> {
    try {
      const storedHash = config.portalPassword;

      // If stored as plain text (dev env), do direct comparison
      if (!storedHash.startsWith('$2')) {
        return inputPassword === storedHash;
      }

      return bcrypt.compare(inputPassword, storedHash);
    } catch (error) {
      logger.error('Password validation failed', error);
      return false;
    }
  }
}
