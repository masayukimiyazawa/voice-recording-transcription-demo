/**
 * Destination Service tests
 */

import '../../setup.js';
import { DestinationService } from '../../../src/domains/destination/destination.service.js';
import { DestinationRepository } from '../../../src/domains/destination/destination.repository.js';

jest.mock('../../../src/domains/destination/destination.repository.js');

describe('DestinationService', () => {
  let service: DestinationService;
  let mockRepository: jest.Mocked<DestinationRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = new DestinationRepository() as jest.Mocked<DestinationRepository>;
    service = new DestinationService(mockRepository);
  });

  describe('getDestination', () => {
    test('should return current destination', async () => {
      const mockDest = {
        phoneNumber: '+1234567890',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.getCurrentDestination.mockResolvedValue(mockDest);

      const result = await service.getDestination();

      expect(result).toEqual(mockDest);
      expect(mockRepository.getCurrentDestination).toHaveBeenCalled();
    });

    test('should return null when no destination set', async () => {
      mockRepository.getCurrentDestination.mockResolvedValue(null);

      const result = await service.getDestination();

      expect(result).toBeNull();
    });
  });

  describe('setDestination', () => {
    test('should update destination number', async () => {
      const phoneNumber = '+15551234567';
      const mockDest = {
        phoneNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.updateDestination.mockResolvedValue(mockDest);

      const result = await service.setDestination(phoneNumber);

      expect(result.phoneNumber).toBe(phoneNumber);
      expect(mockRepository.updateDestination).toHaveBeenCalledWith(phoneNumber);
    });

    test('should throw ValidationError for invalid phone number', async () => {
      await expect(service.setDestination('invalid')).rejects.toThrow(
        'Invalid phone number format',
      );
      expect(mockRepository.updateDestination).not.toHaveBeenCalled();
    });

    test('should throw ValidationError for empty phone number', async () => {
      await expect(service.setDestination('')).rejects.toThrow();
    });
  });
});
