/**
 * Destination Service - CRUD for destination phone number
 */

import { logger } from '../../shared/logger.js';
import { ValidationError } from '../../shared/error.handler.js';
import { DestinationRepository } from './destination.repository.js';
import type { DestinationData } from './destination.types.js';

export class DestinationService {
  constructor(private destinationRepository: DestinationRepository) {}

  async getDestination(): Promise<DestinationData | null> {
    return this.destinationRepository.getCurrentDestination();
  }

  async setDestination(phoneNumber: string): Promise<DestinationData> {
    if (!phoneNumber || !this.isValidPhoneNumber(phoneNumber)) {
      throw new ValidationError('Invalid phone number format', { phoneNumber });
    }

    logger.info('Updating destination number', { phoneNumber });
    return this.destinationRepository.updateDestination(phoneNumber);
  }

  private isValidPhoneNumber(phone: string): boolean {
    // E.164 format: +<country code><number>, 8-15 digits total
    return /^\+[1-9]\d{7,14}$/.test(phone);
  }
}
