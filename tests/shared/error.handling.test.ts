/**
 * Error handling and edge case validation tests
 */

import '../setup.js';
import { Request, Response, NextFunction } from 'express';
import { errorHandler, ValidationError, NotFoundError, UnauthorizedError } from '../../src/shared/error.handler.js';
import { CallService } from '../../src/domains/call/call.service.js';
import { DestinationRepository } from '../../src/domains/destination/destination.repository.js';
import { RecordingController } from '../../src/domains/recording/recording.controller.js';
import { RecordingRepository } from '../../src/domains/recording/recording.repository.js';

jest.mock('../../src/domains/destination/destination.repository.js');
jest.mock('../../src/domains/recording/recording.repository.js');

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Error Handler Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockReq = {};
    mockNext = jest.fn();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test('should return 400 for ValidationError', () => {
    const err = new ValidationError('Invalid input', { field: 'phoneNumber' });
    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid input' }),
    );
  });

  test('should return 404 for NotFoundError', () => {
    const err = new NotFoundError('Resource not found');
    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  test('should return 401 for UnauthorizedError', () => {
    const err = new UnauthorizedError();
    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  test('should return 500 for generic errors', () => {
    const err = new Error('Something went wrong');
    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

describe('CallService - NCCO edge cases', () => {
  let callService: CallService;
  let mockDestRepo: jest.Mocked<DestinationRepository>;

  beforeEach(() => {
    mockDestRepo = new DestinationRepository() as jest.Mocked<DestinationRepository>;
    callService = new CallService(mockDestRepo);
  });

  test('should throw when no destination is configured', async () => {
    mockDestRepo.getCurrentDestination.mockResolvedValue(null);

    await expect(
      callService.generateNCCO('test-uuid', '+1234567890', 'https://example.com'),
    ).rejects.toThrow('No destination number configured');
  });
});

describe('Unauthorized portal access', () => {
  test('authMiddleware blocks unauthenticated API requests', () => {
    const { authMiddleware } = require('../../src/middleware/auth.middleware.js');
    const mockReq: any = { session: {}, headers: { accept: 'application/json' } };
    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const mockNext = jest.fn();

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe('Recording download access control', () => {
  let controller: RecordingController;
  let mockRepo: jest.Mocked<RecordingRepository>;

  beforeEach(() => {
    mockRepo = new RecordingRepository() as jest.Mocked<RecordingRepository>;
    controller = new RecordingController(mockRepo);
  });

  test('should return 404 for nonexistent recording download', async () => {
    const mockReq: any = { params: { conversationUuid: 'nonexistent' } };
    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRepo.findByConversationUuid.mockResolvedValue(null);

    await controller.downloadRecording(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });
});
