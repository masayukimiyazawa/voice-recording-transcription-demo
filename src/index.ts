/**
 * Application entry point
 */

import { createApp } from './app.js';
import { config } from './shared/config.js';
import { connectDatabase, disconnectDatabase } from './shared/database.js';
import { initializeVonageClient } from './shared/vonage.client.js';
import { logger } from './shared/logger.js';

async function main(): Promise<void> {
  try {
    logger.info('Starting Vonage Call Proxy application...', {
      env: config.nodeEnv,
      port: config.port,
    });

    // Initialize Vonage client
    initializeVonageClient();

    // Create Express app (MongoDB接続の成否に関わらずサーバーを先に起動)
    const app = createApp();

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`Server listening on port ${config.port}`);
    });

    // MongoDB接続は非同期で試みる（失敗してもサーバーは継続）
    connectDatabase().catch((err) => {
      logger.error('MongoDB connection failed, retrying...', err);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDatabase();
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Fatal error during startup', error);
    process.exit(1);
  }
}

main();
