/**
 * Destination Repository tests
 */

import '../../setup.js';
import { DestinationRepository } from '../../../src/domains/destination/destination.repository.js';
import { Destination } from '../../../src/domains/destination/destination.model.js';

jest.mock('../../../src/domains/destination/destination.model.js');

describe('Destination Repository', () => {
  let repository: DestinationRepository;
  let mockDestinationModel: jest.Mocked<typeof Destination>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDestinationModel = Destination as jest.Mocked<typeof Destination>;
    repository = new DestinationRepository();
  });

  describe('getCurrentDestination', () => {
    test('should return current destination', async () => {
      const mockDest = {
        _id: 'test-id',
        phoneNumber: '+1234567890',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDestinationModel.findOne.mockResolvedValue(mockDest as any);

      const result = await repository.getCurrentDestination();

      expect(result).toEqual(mockDest);
      expect(mockDestinationModel.findOne).toHaveBeenCalled();
    });

    test('should return null if no destination exists', async () => {
      mockDestinationModel.findOne.mockResolvedValue(null);

      const result = await repository.getCurrentDestination();

      expect(result).toBeNull();
    });
  });

  describe('updateDestination', () => {
    test('should update or create destination', async () => {
      const phoneNumber = '+1234567890';
      const mockDest = {
        _id: 'test-id',
        phoneNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDestinationModel.findOneAndUpdate.mockResolvedValue(mockDest as any);

      const result = await repository.updateDestination(phoneNumber);

      expect(result).toEqual(mockDest);
      expect(mockDestinationModel.findOneAndUpdate).toHaveBeenCalledWith(
        {},
        { phoneNumber },
        expect.objectContaining({ upsert: true, new: true }),
      );
    });
  });
});
