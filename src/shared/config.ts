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
  /**
   * Public base URL of this deployment, e.g. https://host.apse1.runtime.vonage.cloud
   * Authoritative source for NCCO webhook URLs and the expected Vonage
   * application webhook configuration. Optional: when empty the runtime falls
   * back to the inbound request's forwarded headers.
   */
  publicBaseUrl: string;

  // Portal
  portalPassword: string;
  sessionSecret: string;

  // Login brute-force protection
  loginRateLimit: {
    enabled: boolean;
    windowMs: number;
    maxFailures: number;
    baseLockoutMs: number;
    maxLockoutMs: number;
    globalMaxFailures: number;
    globalLockoutMs: number;
  };

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

function resolvePrivateKey(): string {
  // VCR / PaaS では秘密鍵ファイルを含められないため、環境変数に鍵の内容が注入される
  const inlineKey = process.env.VONAGE_PRIVATE_KEY || process.env.VCR_PRIVATE_KEY;
  if (inlineKey) {
    return inlineKey.replace(/\\n/g, '\n');
  }

  const keyPath = process.env.VONAGE_PRIVATE_KEY_PATH;
  if (!keyPath) {
    throw new Error(
      'Missing private key: set VONAGE_PRIVATE_KEY (inline key) or VONAGE_PRIVATE_KEY_PATH (key file path)'
    );
  }

  return readFileSync(resolve(keyPath), 'utf8');
}

function validateConfig(): Config {
  const requiredVars = [
    'VONAGE_API_KEY',
    'VONAGE_API_SECRET',
    'VONAGE_APPLICATION_ID',
    'VONAGE_LVN',
    'MONGODB_URI',
    'PORTAL_PASSWORD',
    'SESSION_SECRET',
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const vonageApplicationPrivateKey = resolvePrivateKey();

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: (process.env.NODE_ENV as Config['nodeEnv']) || 'development',
    mongoUri: process.env.MONGODB_URI!,
    vonageApiKey: process.env.VONAGE_API_KEY!,
    vonageApiSecret: process.env.VONAGE_API_SECRET!,
    vonageApplicationId: process.env.VONAGE_APPLICATION_ID!,
    vonagePrivateKeyPath: process.env.VONAGE_PRIVATE_KEY_PATH || '(inline)',
    vonageApplicationPrivateKey,
    vonageLvn: process.env.VONAGE_LVN!,
    publicBaseUrl: (process.env.WEBHOOK_URL || '').trim().replace(/\/+$/, ''),
    portalPassword: process.env.PORTAL_PASSWORD!,
    sessionSecret: process.env.SESSION_SECRET!,
    loginRateLimit: {
      enabled: process.env.LOGIN_RATE_LIMIT_ENABLED !== 'false',
      windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000', 10),
      maxFailures: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_FAILURES || '5', 10),
      baseLockoutMs: parseInt(process.env.LOGIN_RATE_LIMIT_BASE_LOCKOUT_MS || '60000', 10),
      maxLockoutMs: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_LOCKOUT_MS || '900000', 10),
      globalMaxFailures: parseInt(process.env.LOGIN_RATE_LIMIT_GLOBAL_MAX_FAILURES || '30', 10),
      globalLockoutMs: parseInt(process.env.LOGIN_RATE_LIMIT_GLOBAL_LOCKOUT_MS || '300000', 10),
    },
    logLevel: (process.env.LOG_LEVEL as Config['logLevel']) || 'info',
  };
}

export const config: Config = validateConfig();
