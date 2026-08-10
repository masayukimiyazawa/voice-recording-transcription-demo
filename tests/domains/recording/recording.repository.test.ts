/**
 * Recording Repository tests
 */

import '../../setup.js';
import { RecordingRepository } from '../../../src/domains/recording/recording.repository.js';
import { Recording } from '../../../src/domains/recording/recording.model.js';

jest.mock('../../../src/domains/recording/recording.model.js');

describe('Recording Repository', () => {
  let repository: RecordingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new RecordingRepository();
  });

  describe('upsertRecordingMetadata', () => {
    test('should create or update recording metadata', async () => {
      const metadata = {
        conversationUuid: 'test-uuid',
        recordingUuid: 'rec-uuid',
        callerId: '+1234567890',
        destinationId: '+0987654321',
        recordingUrl: 'https://example.com/recording',
        status: 'completed' as const,
      };

      const mockRecording = {
        _id: 'id',
        ...metadata,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (Recording.findOneAndUpdate as jest.Mock).mockResolvedValue(mockRecording);

      const result = await repository.upsertRecordingMetadata(metadata);

      expect(result).toEqual(mockRecording);
      expect(Recording.findOneAndUpdate).toHaveBeenCalledWith(
        { conversationUuid: metadata.conversationUuid },
        expect.objectContaining(metadata),
        expect.objectContaining({ upsert: true, new: true }),
      );
    });
  });

  describe('updateTranscription', () => {
    test('should update transcription data', async () => {
      const conversationUuid = 'test-uuid';
      const transcriptionData = {
        transcriptionUrl: 'https://example.com/transcription',
        text: 'Transcription text',
      };

      const mockRecording = {
        _id: 'id',
        conversationUuid,
        transcription: transcriptionData,
        updatedAt: new Date(),
      };

      (Recording.findOneAndUpdate as jest.Mock).mockResolvedValue(mockRecording);

      const result = await repository.updateTranscription(conversationUuid, transcriptionData);

      expect(result).toBeDefined();
      expect(Recording.findOneAndUpdate).toHaveBeenCalledWith(
        { conversationUuid },
        expect.objectContaining({
          transcription: expect.objectContaining(transcriptionData),
        }),
        { new: true },
      );
    });
  });

  describe('findByConversationUuid', () => {
    test('should find recording by conversation UUID', async () => {
      const conversationUuid = 'test-uuid';
      const mockRecording = {
        _id: 'id',
        conversationUuid,
        recordingUuid: 'rec-uuid',
      };

      (Recording.findOne as jest.Mock).mockResolvedValue(mockRecording);

      const result = await repository.findByConversationUuid(conversationUuid);

      expect(result).toEqual(mockRecording);
      expect(Recording.findOne).toHaveBeenCalledWith({ conversationUuid });
    });

    test('should return null when recording not found', async () => {
      (Recording.findOne as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByConversationUuid('nonexistent-uuid');

      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    test('should throw when upsertRecordingMetadata fails', async () => {
      (Recording.findOneAndUpdate as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(
        repository.upsertRecordingMetadata({
          conversationUuid: 'test-uuid',
          recordingUuid: 'rec-uuid',
          callerId: '+1234567890',
          destinationId: '+0987654321',
          recordingUrl: 'https://example.com/recording',
          status: 'completed',
        }),
      ).rejects.toThrow('DB error');
    });

    test('should throw when updateTranscription fails', async () => {
      (Recording.findOneAndUpdate as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(
        repository.updateTranscription('test-uuid', {
          transcriptionUrl: 'https://example.com/transcription',
        }),
      ).rejects.toThrow('DB error');
    });
  });
});
