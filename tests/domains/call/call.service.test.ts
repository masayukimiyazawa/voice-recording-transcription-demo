/**
 * Call Service tests
 */

import '../../setup.js';
import { CallService } from '../../../src/domains/call/call.service.js';
import { DestinationRepository } from '../../../src/domains/destination/destination.repository.js';

jest.mock('../../../src/domains/destination/destination.repository.js');

describe('Call Service', () => {
  let callService: CallService;
  let mockDestinationRepository: jest.Mocked<DestinationRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDestinationRepository = new DestinationRepository() as jest.Mocked<DestinationRepository>;
    callService = new CallService(mockDestinationRepository);
  });

  describe('generateNCCO', () => {
    test('should generate valid NCCO array', async () => {
      mockDestinationRepository.getCurrentDestination.mockResolvedValue({
        phoneNumber: '+1234567890',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await callService.generateNCCO('test-conversation-uuid', '+0987654321', 'https://example.com');

      expect(Array.isArray(result.ncco)).toBe(true);
      expect(result.ncco.length).toBeGreaterThan(0);
    });

    test('should include talk action with greeting', async () => {
      mockDestinationRepository.getCurrentDestination.mockResolvedValue({
        phoneNumber: '+1234567890',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await callService.generateNCCO('test-conversation-uuid', '+0987654321', 'https://example.com');

      const talkAction = result.ncco.find((action: any) => action.action === 'talk');
      expect(talkAction).toBeDefined();
      expect((talkAction as any).text).toBeDefined();
    });

    test('should include record action with split audio', async () => {
      mockDestinationRepository.getCurrentDestination.mockResolvedValue({
        phoneNumber: '+1234567890',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await callService.generateNCCO('test-conversation-uuid', '+0987654321', 'https://example.com');

      const recordAction = result.ncco.find((action: any) => action.action === 'record');
      expect(recordAction).toBeDefined();
      expect((recordAction as any).split).toBe('conversation');
    });

    test('should include connect action to destination', async () => {
      const destinationNumber = '+1234567890';
      mockDestinationRepository.getCurrentDestination.mockResolvedValue({
        phoneNumber: destinationNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await callService.generateNCCO('test-conversation-uuid', '+0987654321', 'https://example.com');

      const connectAction = result.ncco.find((action: any) => action.action === 'connect');
      expect(connectAction).toBeDefined();
      // + は Vonage API 渡前に除去される
      expect((connectAction as any).endpoint[0].number).toBe('1234567890');
    });

    test('should throw error if destination is not found', async () => {
      mockDestinationRepository.getCurrentDestination.mockResolvedValue(null);

      await expect(
        callService.generateNCCO('test-conversation-uuid', '+0987654321', 'https://example.com'),
      ).rejects.toThrow('No destination number configured');
    });

    test('should set eventUrl for webhooks', async () => {
      mockDestinationRepository.getCurrentDestination.mockResolvedValue({
        phoneNumber: '+1234567890',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await callService.generateNCCO('test-conversation-uuid', '+0987654321', 'https://example.com');

      const recordAction = result.ncco.find((action: any) => action.action === 'record');
      expect((recordAction as any).eventUrl).toBeDefined();
      expect(Array.isArray((recordAction as any).eventUrl)).toBe(true);
      expect((recordAction as any).eventUrl[0]).toContain('https://example.com');
    });
  });
});
