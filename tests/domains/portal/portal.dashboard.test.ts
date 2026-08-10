/**
 * Portal dashboard and call history tests
 */

import '../../setup.js';
import { Request, Response } from 'express';
import { DashboardController } from '../../../src/domains/portal/dashboard.controller.js';
import { RecordingRepository } from '../../../src/domains/recording/recording.repository.js';

jest.mock('../../../src/domains/recording/recording.repository.js');

describe('DashboardController', () => {
  let controller: DashboardController;
  let mockRecordingRepo: jest.Mocked<RecordingRepository>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordingRepo = new RecordingRepository() as jest.Mocked<RecordingRepository>;
    controller = new DashboardController(mockRecordingRepo);

    mockReq = { query: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      render: jest.fn().mockReturnThis(),
    };
  });

  describe('getCallHistory', () => {
    test('should return paginated call history', async () => {
      const mockRecordings = [
        { _id: 'id1', conversationUuid: 'uuid-1', callerId: '+1111111111', status: 'completed' },
        { _id: 'id2', conversationUuid: 'uuid-2', callerId: '+2222222222', status: 'completed' },
      ];

      mockRecordingRepo.findPaginated = jest.fn().mockResolvedValue({
        recordings: mockRecordings,
        total: 2,
        page: 1,
        limit: 10,
      });

      await controller.getCallHistory(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          recordings: mockRecordings,
          total: 2,
        }),
      );
    });

    test('should use default pagination params', async () => {
      mockRecordingRepo.findPaginated = jest.fn().mockResolvedValue({
        recordings: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      await controller.getCallHistory(mockReq as Request, mockRes as Response);

      expect(mockRecordingRepo.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 10 }),
      );
    });

    test('should accept page and limit query params', async () => {
      mockReq.query = { page: '2', limit: '20' };

      mockRecordingRepo.findPaginated = jest.fn().mockResolvedValue({
        recordings: [],
        total: 0,
        page: 2,
        limit: 20,
      });

      await controller.getCallHistory(mockReq as Request, mockRes as Response);

      expect(mockRecordingRepo.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 20 }),
      );
    });
  });
});
