/**
 * Portal destination and recording access tests
 */

import '../../setup.js';
import { Request, Response } from 'express';
import { RecordingController } from '../../../src/domains/recording/recording.controller.js';
import { RecordingRepository } from '../../../src/domains/recording/recording.repository.js';

jest.mock('../../../src/domains/recording/recording.repository.js');

describe('RecordingController', () => {
  let controller: RecordingController;
  let mockRepo: jest.Mocked<RecordingRepository>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = new RecordingRepository() as jest.Mocked<RecordingRepository>;
    controller = new RecordingController(mockRepo);

    mockReq = { params: {}, headers: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
  });

  describe('getRecording', () => {
    test('should return recording by conversationUuid', async () => {
      const mockRecording = {
        _id: 'id',
        conversationUuid: 'test-uuid',
        callerId: '+1234567890',
        status: 'completed',
        transcription: { text: 'Hello', transcriptionUrl: 'https://example.com' },
      };

      mockReq.params = { conversationUuid: 'test-uuid' };
      mockRepo.findByConversationUuid.mockResolvedValue(mockRecording as any);

      await controller.getRecording(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({ recording: mockRecording });
    });

    test('should return 404 when recording not found', async () => {
      mockReq.params = { conversationUuid: 'nonexistent-uuid' };
      mockRepo.findByConversationUuid.mockResolvedValue(null);

      await controller.getRecording(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('downloadRecording', () => {
    test('should stream recording with JWT auth', async () => {
      const recordingUrl = 'https://api.vonage.com/v1/files/test-recording';
      const mockRecording = {
        _id: 'id',
        conversationUuid: 'test-uuid',
        recordingUrl,
        status: 'completed',
      };

      mockReq.params = { uuid: 'test-uuid' };
      mockRepo.findByConversationUuid.mockResolvedValue(mockRecording as any);

      // fetch をモックして認証済みダウンロードをシミュレート
      const mockBuffer = Buffer.from('mock-audio-data');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'audio/mpeg' },
        arrayBuffer: () => Promise.resolve(mockBuffer.buffer),
      } as any);

      const mockSend = jest.fn();
      (mockRes as any).send = mockSend;

      await controller.downloadRecording(mockReq as Request, mockRes as Response);

      expect(global.fetch).toHaveBeenCalledWith(recordingUrl, expect.objectContaining({
        headers: expect.objectContaining({ Authorization: expect.stringContaining('Bearer') }),
      }));
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment'));
    });

    test('should return 404 when recording not found for download', async () => {
      mockReq.params = { conversationUuid: 'nonexistent-uuid' };
      mockRepo.findByConversationUuid.mockResolvedValue(null);

      await controller.downloadRecording(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
