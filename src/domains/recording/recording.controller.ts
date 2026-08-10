/**
 * Recording Controller - recording retrieval and download
 */

import { Request, Response } from 'express';
import { RecordingRepository } from './recording.repository.js';
import { logger } from '../../shared/logger.js';
import { generateVonageJwt } from '../../shared/vonage.client.js';

export class RecordingController {
  constructor(private recordingRepository: RecordingRepository) {}

  async getRecording(req: Request, res: Response): Promise<void> {
    const uuid = req.params['uuid'] as string;

    const recording = await this.recordingRepository.findByConversationUuid(uuid);

    if (!recording) {
      res.status(404).json({ error: 'Recording not found' });
      return;
    }

    res.json({ recording });
  }

  async downloadRecording(req: Request, res: Response): Promise<void> {
    const uuid = req.params['uuid'] as string;

    const recording = await this.recordingRepository.findByConversationUuid(uuid);

    if (!recording) {
      res.status(404).json({ error: 'Recording not found' });
      return;
    }

    logger.info('Downloading recording from Vonage', { uuid });

    // Vonage JWT でサーバー側から認証付きダウンロード
    const jwt = generateVonageJwt();

    const vonageRes = await fetch(recording.recordingUrl, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (!vonageRes.ok) {
      logger.error('Failed to fetch recording from Vonage', { status: vonageRes.status });
      res.status(502).json({ error: 'Failed to fetch recording from Vonage' });
      return;
    }

    res.setHeader('Content-Type', vonageRes.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="recording-${uuid}.mp3"`);

    const buffer = await vonageRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  }
}
