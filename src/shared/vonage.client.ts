/**
 * Vonage SDK client initialization
 */

import { Vonage } from '@vonage/server-sdk';
import { tokenGenerate } from '@vonage/jwt';
import { config } from './config.js';
import { logger } from './logger.js';

let vonageClient: Vonage | null = null;

export function initializeVonageClient(): Vonage {
  if (vonageClient) {
    return vonageClient;
  }

  try {
    vonageClient = new Vonage({
      apiKey: config.vonageApiKey,
      apiSecret: config.vonageApiSecret,
      applicationId: config.vonageApplicationId,
      privateKey: config.vonageApplicationPrivateKey,
    });

    logger.info('Vonage client initialized successfully');
    return vonageClient;
  } catch (error) {
    logger.error('Failed to initialize Vonage client', error);
    throw error;
  }
}

export function generateVonageJwt(): string {
  return tokenGenerate(config.vonageApplicationId, config.vonageApplicationPrivateKey);
}

export function getVonageClient(): Vonage {
  if (!vonageClient) {
    return initializeVonageClient();
  }
  return vonageClient;
}
