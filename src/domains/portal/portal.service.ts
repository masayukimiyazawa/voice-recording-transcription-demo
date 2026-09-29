/**
 * Portal Service - authentication and session logic
 */

import bcrypt from 'bcrypt';
import { createHash, timingSafeEqual } from 'crypto';
import { config } from '../../shared/config.js';
import { logger } from '../../shared/logger.js';

/**
 * Compare two strings without leaking their contents through response timing.
 * Both sides are hashed first so the buffers are always the same length.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

export class PortalService {
  async validatePassword(inputPassword: string): Promise<boolean> {
    try {
      const storedHash = config.portalPassword;

      // If stored as plain text (dev env), do constant-time direct comparison
      if (!storedHash.startsWith('$2')) {
        return safeEqual(inputPassword, storedHash);
      }

      return bcrypt.compare(inputPassword, storedHash);
    } catch (error) {
      logger.error('Password validation failed', error);
      return false;
    }
  }
}
