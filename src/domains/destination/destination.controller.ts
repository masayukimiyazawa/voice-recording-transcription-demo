/**
 * Destination Controller - HTTP endpoints for destination management
 */

import { Request, Response } from 'express';
import { DestinationService } from './destination.service.js';
import { ValidationError } from '../../shared/error.handler.js';
import { logger } from '../../shared/logger.js';

export class DestinationController {
  constructor(private destinationService: DestinationService) {}

  async getDestination(_req: Request, res: Response): Promise<void> {
    const destination = await this.destinationService.getDestination();
    res.json({ destination });
  }

  async setDestination(req: Request, res: Response): Promise<void> {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      throw new ValidationError('phoneNumber is required');
    }

    logger.info('Setting destination', { phoneNumber });
    const destination = await this.destinationService.setDestination(phoneNumber);

    res.json({ destination });
  }
}
