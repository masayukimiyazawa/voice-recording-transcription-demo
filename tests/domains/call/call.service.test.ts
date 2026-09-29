/**
 * Call Service tests
 */

import '../../setup.js';
import { CallService } from '../../../src/domains/call/call.service.js';
import { DestinationRepository } from '../../../src/domains/destination/destination.repository.js';
import { SettingsRepository } from '../../../src/domains/settings/settings.repository.js';
import type { NCCOTalkAction } from '../../../src/domains/call/call.types.js';

jest.mock('../../../src/domains/destination/destination.repository.js');
jest.mock('../../../src/domains/settings/settings.repository.js');

describe('Call Service', () => {
  let callService: CallService;
  let mockDestinationRepository: jest.Mocked<DestinationRepository>;
  let mockSettingsRepository: jest.Mocked<SettingsRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDestinationRepository = new DestinationRepository() as jest.Mocked<DestinationRepository>;
    mockSettingsRepository = new SettingsRepository() as jest.Mocked<SettingsRepository>;
    callService = new CallService(mockDestinationRepository, mockSettingsRepository);
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

    test('should include a talk action with the English greeting by default', async () => {
      mockDestinationRepository.getCurrentDestination.mockResolvedValue({
        phoneNumber: '+1234567890',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockSettingsRepository.get.mockResolvedValue(undefined as any);

      const result = await callService.generateNCCO('test-conversation-uuid', '+0987654321', 'https://example.com');

      // The greeting language follows the portal language setting, so exactly
      // one talk action is produced.
      const talkActions = result.ncco.filter((action: any) => action.action === 'talk') as NCCOTalkAction[];
      expect(talkActions.length).toBe(1);
      expect(talkActions[0].text).toContain('Thank you for calling');
      expect(talkActions[0].language).toBe('en-US');
    });

    test('should normalise the LVN and destination to bare digits', async () => {
      // Regression: a VCR secret written with a trailing newline produced
      // from: '09011112222\n', which the Voice API rejects and the call is
      // dropped immediately.
      process.env.VONAGE_LVN = '  +09011112222\n';
      mockDestinationRepository.getCurrentDestination.mockResolvedValue({
        phoneNumber: ' +09022223333 ',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockSettingsRepository.get.mockResolvedValue(undefined as any);

      const result = await callService.generateNCCO('test-conversation-uuid', '+0987654321', 'https://example.com');

      const connect = result.ncco.find((a: any) => a.action === 'connect') as any;
      expect(connect.from).toBe('09011112222');
      expect(connect.endpoint[0].number).toBe('09022223333');
    });

    test('should use the Japanese greeting when the portal language is ja-JP', async () => {
      mockDestinationRepository.getCurrentDestination.mockResolvedValue({
        phoneNumber: '+1234567890',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockSettingsRepository.get.mockResolvedValue('ja-JP' as any);

      const result = await callService.generateNCCO('test-conversation-uuid', '+0987654321', 'https://example.com');

      const talkActions = result.ncco.filter((action: any) => action.action === 'talk') as NCCOTalkAction[];
      expect(talkActions.length).toBe(1);
      expect(talkActions[0].text).toContain('お電話ありがとうございます');
      expect(talkActions[0].language).toBe('ja-JP');
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
      // + は Vonage API に渡す前に除去される
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
