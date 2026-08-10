/**
 * Destination Controller tests
 */

import '../../setup.js';
import { Request, Response } from 'express';
import { DestinationController } from '../../../src/domains/destination/destination.controller.js';
import { DestinationService } from '../../../src/domains/destination/destination.service.js';
import { DestinationRepository } from '../../../src/domains/destination/destination.repository.js';

jest.mock('../../../src/domains/destination/destination.service.js');
jest.mock('../../../src/domains/destination/destination.repository.js');

describe('DestinationController', () => {
  let controller: DestinationController;
  let mockService: jest.Mocked<DestinationService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    const mockRepo = new DestinationRepository() as jest.Mocked<DestinationRepository>;
    mockService = new DestinationService(mockRepo) as jest.Mocked<DestinationService>;
    controller = new DestinationController(mockService);

    mockReq = { body: {}, params: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('GET /api/destination', () => {
    test('should return current destination', async () => {
      const mockDest = {
        phoneNumber: '+1234567890',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockService.getDestination.mockResolvedValue(mockDest);

      await controller.getDestination(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ destination: mockDest }),
      );
    });

    test('should return null when no destination configured', async () => {
      mockService.getDestination.mockResolvedValue(null);

      await controller.getDestination(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({ destination: null });
    });
  });

  describe('POST /api/destination', () => {
    test('should update destination and return 200', async () => {
      const phoneNumber = '+15551234567';
      const mockDest = {
        phoneNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReq.body = { phoneNumber };
      mockService.setDestination.mockResolvedValue(mockDest);

      await controller.setDestination(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ destination: mockDest }),
      );
    });

    test('should throw when phoneNumber is missing from body', async () => {
      mockReq.body = {};

      await expect(
        controller.setDestination(mockReq as Request, mockRes as Response),
      ).rejects.toThrow();
    });
  });
});
