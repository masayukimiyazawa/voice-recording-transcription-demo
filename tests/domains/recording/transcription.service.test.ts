/**
 * Transcription Service tests
 */

import '../../setup.js';
import { TranscriptionService } from '../../../src/domains/recording/transcription.service.js';
import { RecordingRepository } from '../../../src/domains/recording/recording.repository.js';

jest.mock('../../../src/domains/recording/recording.repository.js');
jest.mock('../../../src/shared/vonage.client.js');

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('TranscriptionService', () => {
  let service: TranscriptionService;
  let mockRepository: jest.Mocked<RecordingRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = new RecordingRepository() as jest.Mocked<RecordingRepository>;
    service = new TranscriptionService(mockRepository);
  });

  describe('handleTranscriptionWebhook', () => {
    test('should process transcription webhook and update recording', async () => {
      const webhookData = {
        conversation_uuid: 'test-uuid',
        transcription_url: 'https://api.vonage.com/v1/files/test-transcription',
      };

      const transcriptionText = 'Hello, this is a test transcription.';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ alternatives: [{ transcript: transcriptionText }] }] }),
      });

      const mockRecording = {
        _id: 'id',
        conversationUuid: 'test-uuid',
        transcription: { text: transcriptionText },
      };

      mockRepository.updateTranscription.mockResolvedValue(mockRecording as any);

      const result = await service.handleTranscriptionWebhook(webhookData);

      expect(result).toBeDefined();
      expect(mockRepository.updateTranscription).toHaveBeenCalledWith(
        'test-uuid',
        expect.objectContaining({ transcriptionUrl: webhookData.transcription_url }),
      );
    });

    test('should throw error if conversation_uuid is missing', async () => {
      const webhookData = {
        transcription_url: 'https://api.vonage.com/v1/files/test',
      };

      await expect(service.handleTranscriptionWebhook(webhookData as any)).rejects.toThrow(
        'Missing required transcription webhook fields',
      );
    });

    test('should throw error if transcription_url is missing', async () => {
      const webhookData = {
        conversation_uuid: 'test-uuid',
      };

      await expect(service.handleTranscriptionWebhook(webhookData as any)).rejects.toThrow(
        'Missing required transcription webhook fields',
      );
    });

    test('should store transcription URL even when fetch fails', async () => {
      const webhookData = {
        conversation_uuid: 'test-uuid',
        transcription_url: 'https://api.vonage.com/v1/files/test-transcription',
      };

      mockFetch.mockRejectedValue(new Error('Fetch failed'));

      mockRepository.updateTranscription.mockResolvedValue({ _id: 'id' } as any);

      await service.handleTranscriptionWebhook(webhookData);

      expect(mockRepository.updateTranscription).toHaveBeenCalledWith(
        'test-uuid',
        expect.objectContaining({ transcriptionUrl: webhookData.transcription_url }),
      );
    });
  });

  describe('fetchTranscriptionData', () => {
    test('should fetch and parse transcription text', async () => {
      const transcriptionUrl = 'https://api.vonage.com/v1/files/test';
      const mockData = { channels: [{ transcript: [{ sentence: 'テスト', timestamp: 0, duration: 1000 }] }] };

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockData),
      });

      const result = await service.fetchTranscriptionData(transcriptionUrl);

      expect(result?.text).toBe('テスト');
      expect(result?.utterances).toHaveLength(1);
    });

    test('should return null if fetch response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      });

      const result = await service.fetchTranscriptionData('https://example.com');

      expect(result).toBeNull();
    });

    test('should return null if fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.fetchTranscriptionData('https://example.com');

      expect(result).toBeNull();
    });
  });
});
