/**
 * Recording Service - handles recording-related business logic
 */

import { logger } from '../../shared/logger.js';
import { RecordingRepository } from './recording.repository.js';
import { ValidationError } from '../../shared/error.handler.js';

export class RecordingService {
  constructor(private recordingRepository: RecordingRepository) {}

  /**
   * 着信時点で発信元・宛先情報をDBに事前登録
   */
  async initCallRecord(conversationUuid: string, callerId: string, destinationId: string): Promise<void> {
    await this.recordingRepository.upsertRecordingMetadata({
      conversationUuid,
      recordingUuid: `pending-${conversationUuid}`,
      callerId,
      destinationId,
      recordingUrl: '',
      status: 'pending',
    });
  }

  /**
   * Process incoming recording webhook from Vonage
   */
  async handleRecordingWebhook(webhookData: any): Promise<any> {
    const { conversation_uuid, recording_uuid, recording_url } = webhookData;

    // 録音完了イベント以外（通話状態イベント等）は無視して正常終了
    if (!recording_url || !recording_uuid) {
      logger.info('Skipping non-recording event', { status: webhookData.status, detail: webhookData.detail });
      return { skipped: true };
    }

    if (!conversation_uuid) {
      throw new ValidationError('Missing required webhook fields', {
        provided: Object.keys(webhookData),
      });
    }

    // 発信元・宛先は着信時に登録済みが期待値。存在すれば保持、なければ 'unknown'
    const existingRecord = await this.recordingRepository.findByConversationUuid(conversation_uuid);
    const callerId = existingRecord?.callerId || webhookData.caller_id || 'unknown';
    const destinationId = existingRecord?.destinationId || webhookData.destination_id || 'unknown';

    logger.info('Processing recording webhook', {
      conversationUuid: conversation_uuid,
      recordingUuid: recording_uuid,
    });

    // Upsert recording metadata
    const recording = await this.recordingRepository.upsertRecordingMetadata({
      conversationUuid: conversation_uuid,
      recordingUuid: recording_uuid,
      callerId,
      destinationId,
      recordingUrl: recording_url,
      status: 'completed',
    });

    return recording;
  }
}
