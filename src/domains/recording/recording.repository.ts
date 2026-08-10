/**
 * Recording Repository - MongoDB persistence layer for recordings
 */

import { logger } from '../../shared/logger.js';
import { Recording } from './recording.model.js';
import type { RecordingMetadata, TranscriptionData } from './recording.types.js';

export class RecordingRepository {
  /**
   * Idempotent upsert of recording metadata
   */
  async upsertRecordingMetadata(metadata: RecordingMetadata): Promise<any> {
    try {
      const recording = await Recording.findOneAndUpdate(
        { conversationUuid: metadata.conversationUuid },
        {
          conversationUuid: metadata.conversationUuid,
          recordingUuid: metadata.recordingUuid,
          callerId: metadata.callerId,
          destinationId: metadata.destinationId,
          recordingUrl: metadata.recordingUrl,
          status: metadata.status,
        },
        { upsert: true, new: true },
      );

      logger.info('Upserted recording metadata', { conversationUuid: metadata.conversationUuid });
      return recording;
    } catch (error) {
      logger.error('Failed to upsert recording metadata', error);
      throw error;
    }
  }

  /**
   * Update transcription data for a recording
   */
  async updateTranscription(
    conversationUuid: string,
    transcriptionData: Partial<TranscriptionData>,
  ): Promise<any> {
    try {
      const recording = await Recording.findOneAndUpdate(
        { conversationUuid },
        {
          transcription: {
            ...transcriptionData,
            retrievedAt: new Date(),
          },
        },
        { new: true },
      );

      logger.info('Updated transcription', { conversationUuid });
      return recording;
    } catch (error) {
      logger.error('Failed to update transcription', error);
      throw error;
    }
  }

  /**
   * Find recording by conversation UUID
   */
  async findByConversationUuid(conversationUuid: string): Promise<any | null> {
    try {
      const recording = await Recording.findOne({ conversationUuid });
      return recording;
    } catch (error) {
      logger.error('Failed to find recording', error);
      throw error;
    }
  }

  /**
   * Find recordings with pagination
   */
  async findPaginated(opts: { page: number; limit: number }): Promise<{
    recordings: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const { page, limit } = opts;
      const skip = (page - 1) * limit;

      const [recordings, total] = await Promise.all([
        Recording.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
        Recording.countDocuments(),
      ]);

      return { recordings, total, page, limit };
    } catch (error) {
      logger.error('Failed to fetch paginated recordings', error);
      throw error;
    }
  }
}
