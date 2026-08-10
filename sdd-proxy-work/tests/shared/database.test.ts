import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../../src/shared/database';
import { getEnv } from '../../src/config/env';
import { logger } from '../../src/config/logger';

jest.mock('mongoose', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
}));
jest.mock('../../src/config/env');
jest.mock('../../src/config/logger');

describe('Database Utility', () => {
  const mockEnv = {
    MONGODB_URI: 'mongodb://localhost:27017/test',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getEnv as jest.Mock).mockReturnValue(mockEnv);
  });

  it('should connect to MongoDB successfully', async () => {
    (mongoose.connect as jest.Mock).mockResolvedValue(undefined as any);
    
    await connectDatabase();
    
    expect(mongoose.connect).toHaveBeenCalledWith(mockEnv.MONGODB_URI);
    expect(logger.info).toHaveBeenCalledWith('Successfully connected to MongoDB Atlas');
  });

  it('should throw error if connection fails', async () => {
    const error = new Error('Connection failed');
    (mongoose.connect as jest.Mock).mockRejectedValueOnce(error as any);
    
    await expect(connectDatabase()).rejects.toThrow('Connection failed');
    expect(logger.error).toHaveBeenCalledWith('Failed to connect to MongoDB Atlas', { error });
  });

  it('should disconnect from MongoDB successfully', async () => {
    (mongoose.disconnect as jest.Mock).mockResolvedValue(undefined as any);
    
    await disconnectDatabase();
    
    expect(mongoose.disconnect).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('Disconnected from MongoDB Atlas');
  });
});
