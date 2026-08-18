/**
 * Call Controller - HTTP endpoints for call handling
 */

import { Request, Response } from 'express';
import { CallService } from './call.service.js';
import { RecordingService } from '../recording/recording.service.js';
import { ValidationError } from '../../shared/error.handler.js';
import { logger } from '../../shared/logger.js';

export class CallController {
  constructor(
    private callService: CallService,
    private recordingService: RecordingService,
  ) {}

  /**
   * Handle incoming call answer request
   * GET /call/answer?conversation_uuid=...&from=...&to=...
   */
  async answerCall(req: Request, res: Response): Promise<void> {
    const { conversation_uuid, from } = req.query;

    if (!conversation_uuid || typeof conversation_uuid !== 'string') {
      throw new ValidationError('Missing or invalid conversation_uuid');
    }

    if (!from || typeof from !== 'string') {
      throw new ValidationError('Missing or invalid from number');
    }

    logger.info('Answering call', { conversation_uuid, from });

    // Cloudflare Tunnel / リバースプロキシ経由の公開URLを優先して使用
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
    const baseUrl = process.env.WEBHOOK_URL || `${proto}://${host}`;

    // 言語設定は DB から取得（Vonage webhook にはセッション Cookie がないため）
    const { ncco, destinationNumber } = await this.callService.generateNCCO(conversation_uuid, from, baseUrl);

    // 着信時点で発信元・宛先情報をDBに保存しておく（録音Webhookにはこの情報が含まれないため）
    await this.recordingService.initCallRecord(conversation_uuid, from, destinationNumber).catch(() => {});

    res.json(ncco);
  }

  /**
   * Handle recording webhook event
   * POST /event/recording
   */
  async handleRecordingWebhook(req: Request, res: Response): Promise<void> {
    const recordingData = req.body;

    logger.info('Received recording webhook', recordingData);

    // Process the recording webhook
    const recording = await this.recordingService.handleRecordingWebhook(recordingData);

    if (recording?.skipped) {
      res.status(200).json({ status: 'skipped' });
      return;
    }

    res.status(200).json({ status: 'received', recordingId: recording?._id });
  }
}
