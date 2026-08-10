/**
 * Recording Service tests
 */

import '../../setup.js';
import { RecordingService } from '../../../src/domains/recording/recording.service.js';
import { RecordingRepository } from '../../../src/domains/recording/recording.repository.js';

jest.mock('../../../src/domains/recording/recording.repository.js');

describe('Recording Service', () => {
  let service: RecordingService;
  let mockRepository: jest.Mocked<RecordingRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = new RecordingRepository() as jest.Mocked<RecordingRepository>;
    service = new RecordingService(mockRepository);
  });

  describe('handleRecordingWebhook', () => {
    test('should process recording webhook and upsert metadata', async () => {
      const webhookData = {
        conversation_uuid: 'test-uuid',
        recording_uuid: 'rec-uuid',
        recording_url: 'https://example.com/recording',
      };

      const mockRecording = {
        _id: 'id',
        conversationUuid: 'test-uuid',
        recordingUuid: 'rec-uuid',
      };

      mockRepository.upsertRecordingMetadata.mockResolvedValue(mockRecording);

      const result = await service.handleRecordingWebhook(webhookData as any);

      expect(result).toBeDefined();
      expect(mockRepository.upsertRecordingMetadata).toHaveBeenCalled();
    });

    test('should skip non-recording events (missing recording_uuid or url)', async () => {
      const webhookData = {
        conversation_uuid: 'test-uuid',
        // missing recording_uuid
      };

      const result = await service.handleRecordingWebhook(webhookData as any);
      expect(result).toEqual({ skipped: true });
      expect(mockRepository.upsertRecordingMetadata).not.toHaveBeenCalled();
    });

    test('should extract caller_id and destination_id from webhook data', async () => {
      const webhookData = {
        conversation_uuid: 'test-uuid',
        recording_uuid: 'rec-uuid',
        recording_url: 'https://example.com/recording',
        caller_id: '+1234567890',
        destination_id: '+0987654321',
      };

      mockRepository.upsertRecordingMetadata.mockResolvedValue({ _id: 'id' } as any);

      await service.handleRecordingWebhook(webhookData as any);

      expect(mockRepository.upsertRecordingMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          callerId: '+1234567890',
          destinationId: '+0987654321',
          status: 'completed',
        }),
      );
    });

    test('should default caller_id and destination_id to "unknown" if not provided', async () => {
      const webhookData = {
        conversation_uuid: 'test-uuid',
        recording_uuid: 'rec-uuid',
        recording_url: 'https://example.com/recording',
      };

      mockRepository.upsertRecordingMetadata.mockResolvedValue({ _id: 'id' } as any);

      await service.handleRecordingWebhook(webhookData as any);

      expect(mockRepository.upsertRecordingMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          callerId: 'unknown',
          destinationId: 'unknown',
        }),
      );
    });

    test('should handle duplicate webhook calls idempotently', async () => {
      const webhookData = {
        conversation_uuid: 'test-uuid',
        recording_uuid: 'rec-uuid',
        recording_url: 'https://example.com/recording',
      };

      mockRepository.upsertRecordingMetadata.mockResolvedValue({ _id: 'id' } as any);

      await service.handleRecordingWebhook(webhookData as any);
      await service.handleRecordingWebhook(webhookData as any);

      expect(mockRepository.upsertRecordingMetadata).toHaveBeenCalledTimes(2);
    });

    test('should skip when recording_url is missing', async () => {
      const webhookData = {
        conversation_uuid: 'test-uuid',
        recording_uuid: 'rec-uuid',
      };

      const result = await service.handleRecordingWebhook(webhookData as any);
      expect(result).toEqual({ skipped: true });
    });
  });
});
