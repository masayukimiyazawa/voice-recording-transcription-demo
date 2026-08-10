/**
 * Call Controller tests
 */

import '../../setup.js';
import { Request, Response } from 'express';
import { CallController } from '../../../src/domains/call/call.controller.js';
import { CallService } from '../../../src/domains/call/call.service.js';
import { RecordingService } from '../../../src/domains/recording/recording.service.js';
import { DestinationRepository } from '../../../src/domains/destination/destination.repository.js';
import { RecordingRepository } from '../../../src/domains/recording/recording.repository.js';

jest.mock('../../../src/domains/call/call.service.js');
jest.mock('../../../src/domains/recording/recording.service.js');
jest.mock('../../../src/domains/destination/destination.repository.js');
jest.mock('../../../src/domains/recording/recording.repository.js');

describe('Call Controller', () => {
  let controller: CallController;
  let mockCallService: jest.Mocked<CallService>;
  let mockRecordingService: jest.Mocked<RecordingService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    const mockDestRepo = new DestinationRepository() as jest.Mocked<DestinationRepository>;
    const mockRecordingRepo = new RecordingRepository() as jest.Mocked<RecordingRepository>;
    mockCallService = new CallService(mockDestRepo) as unknown as jest.Mocked<CallService>;
    mockRecordingService = new RecordingService(mockRecordingRepo) as unknown as jest.Mocked<RecordingService>;
    controller = new CallController(mockCallService, mockRecordingService);

    mockReq = {
      query: {},
      headers: {},
      protocol: 'http',
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe('answerCall', () => {
    test('should return NCCO array', async () => {
      const mockNCCO = [{ action: 'talk', text: 'test' }];
      mockCallService.generateNCCO.mockResolvedValue({ ncco: mockNCCO, destinationNumber: '1234567890' } as any);
      mockRecordingService.initCallRecord = jest.fn().mockResolvedValue(undefined);

      mockReq.query = {
        conversation_uuid: 'test-uuid',
        from: '+1234567890',
      };

      await controller.answerCall(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(mockNCCO);
    });

    test('should handle missing conversation UUID', async () => {
      mockReq.query = {
        from: '+1234567890',
      };

      await expect(controller.answerCall(mockReq as Request, mockRes as Response)).rejects.toThrow();
    });

    test('should return 200 status', async () => {
      const mockNCCO = [{ action: 'talk', text: 'test' }];
      mockCallService.generateNCCO.mockResolvedValue({ ncco: mockNCCO, destinationNumber: '1234567890' } as any);
      mockRecordingService.initCallRecord = jest.fn().mockResolvedValue(undefined);

      mockReq.query = {
        conversation_uuid: 'test-uuid',
        from: '+1234567890',
      };

      await controller.answerCall(mockReq as Request, mockRes as Response);

      expect(mockRes.status).not.toHaveBeenCalledWith(expect.anything());
      expect(mockRes.json).toHaveBeenCalled();
    });

    test('should throw when from parameter is missing', async () => {
      mockReq.query = {
        conversation_uuid: 'test-uuid',
      };

      await expect(controller.answerCall(mockReq as Request, mockRes as Response)).rejects.toThrow();
    });
  });

  describe('handleRecordingWebhook', () => {
    beforeEach(() => {
      mockReq = {
        body: {},
      };
    });

    test('should process recording webhook and return 200', async () => {
      const recordingData = {
        conversation_uuid: 'test-uuid',
        recording_uuid: 'rec-uuid',
        recording_url: 'https://example.com/recording',
      };

      mockReq.body = recordingData;
      mockRecordingService.handleRecordingWebhook.mockResolvedValue({
        _id: 'rec-db-id',
      } as any);

      await controller.handleRecordingWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'received' }),
      );
    });

    test('should pass webhook body to recording service', async () => {
      const recordingData = {
        conversation_uuid: 'test-uuid',
        recording_uuid: 'rec-uuid',
        recording_url: 'https://example.com/recording',
      };

      mockReq.body = recordingData;
      mockRecordingService.handleRecordingWebhook.mockResolvedValue({ _id: 'id' } as any);

      await controller.handleRecordingWebhook(mockReq as Request, mockRes as Response);

      expect(mockRecordingService.handleRecordingWebhook).toHaveBeenCalledWith(recordingData);
    });
  });
});
