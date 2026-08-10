/**
 * Transcription Controller - HTTP endpoints for transcription webhooks
 */

import { Request, Response } from 'express';
import { TranscriptionService } from './transcription.service.js';
import { logger } from '../../shared/logger.js';

export class TranscriptionController {
  constructor(private transcriptionService: TranscriptionService) {}

  async handleTranscriptionWebhook(req: Request, res: Response): Promise<void> {
    const webhookData = req.body;

    logger.info('Received transcription webhook', {
      conversation_uuid: webhookData.conversation_uuid,
    });

    const recording = await this.transcriptionService.handleTranscriptionWebhook(webhookData);

    res.status(200).json({ status: 'received', recordingId: recording?._id });
  }
}
