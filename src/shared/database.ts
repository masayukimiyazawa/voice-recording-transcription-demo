/**
 * MongoDB connection and Mongoose setup
 */

import mongoose from 'mongoose';
import { config } from './config.js';
import { logger } from './logger.js';

export async function connectDatabase(): Promise<void> {
  try {
    logger.info('Connecting to MongoDB...', { uri: config.mongoUri.replace(/:[^:]*@/, ':***@') });
    await mongoose.connect(config.mongoUri);
    logger.info('Connected to MongoDB successfully');
  } catch (error) {
    logger.error('Failed to connect to MongoDB', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    logger.info('Disconnecting from MongoDB...');
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB successfully');
  } catch (error) {
    logger.error('Failed to disconnect from MongoDB', error);
    throw error;
  }
}

export { mongoose };
