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
import { SettingsRepository } from '../../../src/domains/settings/settings.repository.js';
import { config } from '../../../src/shared/config.js';

jest.mock('../../../src/domains/call/call.service.js');
jest.mock('../../../src/domains/recording/recording.service.js');
jest.mock('../../../src/domains/destination/destination.repository.js');
jest.mock('../../../src/domains/recording/recording.repository.js');
jest.mock('../../../src/domains/settings/settings.repository.js');

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
    mockCallService = new CallService(mockDestRepo, new SettingsRepository()) as unknown as jest.Mocked<CallService>;
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
    // config.publicBaseUrl is process-wide; restore it so tests stay isolated.
    let originalBaseUrl = config.publicBaseUrl;

    afterEach(() => {
      config.publicBaseUrl = originalBaseUrl;
    });

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

    test('should read parameters from a POST body', async () => {
      // Regression: Vonage invokes the answer URL as POST and sends the
      // parameters form-encoded, so reading only req.query yielded a 400 and
      // the call was dropped.
      const mockNCCO = [{ action: 'talk', text: 'test' }];
      mockCallService.generateNCCO.mockResolvedValue({ ncco: mockNCCO, destinationNumber: '1234567890' } as any);
      mockRecordingService.initCallRecord = jest.fn().mockResolvedValue(undefined);

      mockReq.query = {};
      mockReq.body = {
        conversation_uuid: 'post-uuid',
        from: '+819012345678',
      };

      await controller.answerCall(mockReq as Request, mockRes as Response);

      expect(mockCallService.generateNCCO).toHaveBeenCalledWith('post-uuid', '+819012345678', expect.any(String));
      expect(mockRes.json).toHaveBeenCalledWith(mockNCCO);
    });

    test('should throw when a POST body omits conversation_uuid', async () => {
      mockReq.query = {};
      mockReq.body = { from: '+819012345678' };

      await expect(controller.answerCall(mockReq as Request, mockRes as Response)).rejects.toThrow();
    });

    test('should build the NCCO webhook base URL from forwarded headers', async () => {
      const mockNCCO = [{ action: 'talk' }];
      mockCallService.generateNCCO.mockResolvedValue({ ncco: mockNCCO, destinationNumber: '1234567890' } as any);
      mockRecordingService.initCallRecord = jest.fn().mockResolvedValue(undefined);

      // Headers are only the fallback: WEBHOOK_URL takes precedence when set.
      originalBaseUrl = config.publicBaseUrl;
      config.publicBaseUrl = '';

      mockReq.query = { conversation_uuid: 'test-uuid', from: '+1234567890' };
      mockReq.headers = {
        'x-forwarded-proto': 'https',
        host: 'proxy.example.com',
      };

      await controller.answerCall(mockReq as Request, mockRes as Response);

      expect(mockCallService.generateNCCO).toHaveBeenCalledWith(
        'test-uuid',
        '+1234567890',
        'https://proxy.example.com',
      );
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

  describe('NCCO base URL resolution', () => {
    const savedBaseUrl = config.publicBaseUrl;

    afterEach(() => {
      config.publicBaseUrl = savedBaseUrl;
    });

    test('prefers WEBHOOK_URL over forwarded headers', async () => {
      mockCallService.generateNCCO.mockResolvedValue({ ncco: [], destinationNumber: '1234567890' } as any);
      mockRecordingService.initCallRecord = jest.fn().mockResolvedValue(undefined);

      config.publicBaseUrl = 'https://public.example.com';

      mockReq.query = { conversation_uuid: 'test-uuid', from: '+1234567890' };
      mockReq.headers = { 'x-forwarded-proto': 'https', host: 'proxy.example.com' };

      await controller.answerCall(mockReq as Request, mockRes as Response);

      expect(mockCallService.generateNCCO).toHaveBeenCalledWith(
        'test-uuid',
        '+1234567890',
        'https://public.example.com',
      );
    });
  });
});
