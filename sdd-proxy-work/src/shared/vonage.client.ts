import { Vonage } from '@vonage/server-sdk';
import { getEnv } from '../config/env';
import { logger } from '../config/logger';

let _client: Vonage | null = null;

export const getVonageClient = (): Vonage => {
  if (!_client) {
    const env = getEnv();
    
    // In a real scenario, we would read the private key from the path
    // For this implementation, we assume the environment is set up correctly
    // and the SDK can access the key.
    
    _client = new Vonage({
      apiKey: env.VONAGE_API_KEY,
      apiSecret: env.VONAGE_API_SECRET,
      applicationId: env.VONAGE_APPLICATION_ID,
      privateKey: env.VONAGE_APPLICATION_PRIVATE_KEY_PATH,
    });
    
    logger.info('Vonage client initialized');
  }
  return _client;
};

export const resetVonageClient = () => {
  _client = null;
};
