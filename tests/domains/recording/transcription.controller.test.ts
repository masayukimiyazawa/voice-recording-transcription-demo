/**
 * Transcription Controller tests
 */

import '../../setup.js';
import { Request, Response } from 'express';
import { TranscriptionController } from '../../../src/domains/recording/transcription.controller.js';
import { TranscriptionService } from '../../../src/domains/recording/transcription.service.js';
import { RecordingRepository } from '../../../src/domains/recording/recording.repository.js';

jest.mock('../../../src/domains/recording/transcription.service.js');
jest.mock('../../../src/domains/recording/recording.repository.js');

describe('TranscriptionController', () => {
  let controller: TranscriptionController;
  let mockService: jest.Mocked<TranscriptionService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    const mockRepo = new RecordingRepository() as jest.Mocked<RecordingRepository>;
    mockService = new TranscriptionService(mockRepo) as jest.Mocked<TranscriptionService>;
    controller = new TranscriptionController(mockService);

    mockReq = { body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('handleTranscriptionWebhook', () => {
    test('should process transcription webhook and return 200', async () => {
      const webhookData = {
        conversation_uuid: 'test-uuid',
        transcription_url: 'https://api.vonage.com/v1/files/transcription',
      };

      mockReq.body = webhookData;
      mockService.handleTranscriptionWebhook.mockResolvedValue({ _id: 'id' } as any);

      await controller.handleTranscriptionWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'received' }),
      );
    });

    test('should pass webhook body to service', async () => {
      const webhookData = {
        conversation_uuid: 'test-uuid',
        transcription_url: 'https://api.vonage.com/v1/files/transcription',
      };

      mockReq.body = webhookData;
      mockService.handleTranscriptionWebhook.mockResolvedValue({ _id: 'id' } as any);

      await controller.handleTranscriptionWebhook(mockReq as Request, mockRes as Response);

      expect(mockService.handleTranscriptionWebhook).toHaveBeenCalledWith(webhookData);
    });
  });
});
