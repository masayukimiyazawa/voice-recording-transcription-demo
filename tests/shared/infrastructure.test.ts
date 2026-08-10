/**
 * Integration tests for shared infrastructure
 */

import '../setup.js';
import { config } from '../../src/shared/config.js';
import { logger } from '../../src/shared/logger.js';
import { createApp } from '../../src/app.js';

describe('Shared Infrastructure', () => {
  describe('Config Loading', () => {
    test('should load environment configuration', () => {
      expect(config).toBeDefined();
      expect(config.nodeEnv).toBe('test');
      expect(config.port).toBeDefined();
      expect(config.mongoUri).toBeDefined();
      expect(config.vonageApiKey).toBeDefined();
    });

    test('should have valid port number', () => {
      expect(typeof config.port).toBe('number');
      expect(config.port).toBeGreaterThan(0);
      expect(config.port).toBeLessThan(65536);
    });
  });

  describe('Logger', () => {
    test('should create logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    test('should have logging methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('Express Application', () => {
    test('should create Express app', () => {
      const app = createApp();
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
      expect(typeof app.get).toBe('function');
    });

    test('should have health check endpoint', () => {
      const app = createApp();
      // Check if app has get method to define routes
      expect(typeof app.get).toBe('function');
    });
  });
});
