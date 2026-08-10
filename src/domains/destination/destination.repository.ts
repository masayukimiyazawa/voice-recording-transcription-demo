/**
 * Destination Repository - MongoDB persistence layer
 */

import { logger } from '../../shared/logger.js';
import { Destination } from './destination.model.js';
import type { DestinationData } from './destination.types.js';

export class DestinationRepository {
  /**
   * Get current destination (single record pattern)
   */
  async getCurrentDestination(): Promise<DestinationData | null> {
    try {
      const destination = await Destination.findOne();
      return destination;
    } catch (error) {
      logger.error('Failed to fetch destination', error);
      throw error;
    }
  }

  /**
   * Update or create destination (upsert)
   */
  async updateDestination(phoneNumber: string): Promise<DestinationData> {
    try {
      const destination = await Destination.findOneAndUpdate(
        {}, // Empty filter to update the single record
        { phoneNumber },
        { upsert: true, new: true },
      );

      logger.info('Updated destination', { phoneNumber });

      return destination!;
    } catch (error) {
      logger.error('Failed to update destination', error);
      throw error;
    }
  }
}
