/**
 * Environment configuration loader
 */

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

dotenv.config();

export interface Config {
  // Server
  port: number;
  nodeEnv: 'development' | 'production' | 'test';

  // MongoDB
  mongoUri: string;

  // Vonage
  vonageApiKey: string;
  vonageApiSecret: string;
  vonageApplicationId: string;
  vonagePrivateKeyPath: string;
  vonageApplicationPrivateKey: string;
  vonageLvn: string;

  // Portal
  portalPassword: string;
  sessionSecret: string;

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

function validateConfig(): Config {
  const requiredVars = [
    'VONAGE_API_KEY',
    'VONAGE_API_SECRET',
    'VONAGE_APPLICATION_ID',
    'VONAGE_PRIVATE_KEY_PATH',
    'VONAGE_LVN',
    'MONGODB_URI',
    'PORTAL_PASSWORD',
    'SESSION_SECRET',
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: (process.env.NODE_ENV as Config['nodeEnv']) || 'development',
    mongoUri: process.env.MONGODB_URI!,
    vonageApiKey: process.env.VONAGE_API_KEY!,
    vonageApiSecret: process.env.VONAGE_API_SECRET!,
    vonageApplicationId: process.env.VONAGE_APPLICATION_ID!,
    vonagePrivateKeyPath: process.env.VONAGE_PRIVATE_KEY_PATH!,
    vonageApplicationPrivateKey: readFileSync(resolve(process.env.VONAGE_PRIVATE_KEY_PATH!), 'utf8'),
    vonageLvn: process.env.VONAGE_LVN!,
    portalPassword: process.env.PORTAL_PASSWORD!,
    sessionSecret: process.env.SESSION_SECRET!,
    logLevel: (process.env.LOG_LEVEL as Config['logLevel']) || 'info',
  };
}

export const config: Config = validateConfig();
