import mongoose from 'mongoose';
import { getEnv } from '../config/env';
import { logger } from '../config/logger';

export const connectDatabase = async (): Promise<void> => {
  const { MONGODB_URI } = getEnv();
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Successfully connected to MongoDB Atlas');
  } catch (error) {
    logger.error('Failed to connect to MongoDB Atlas', { error });
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB Atlas');
  } catch (error) {
    logger.error('Error during MongoDB disconnection', { error });
    throw error;
  }
};
