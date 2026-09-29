/**
 * Integration tests for shared infrastructure
 */

import '../setup.js';
import request from 'supertest';
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

  describe('Top-level routes', () => {
    const app = createApp();

    test('GET /_/health returns 200 for the platform probe', async () => {
      const res = await request(app).get('/_/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    test('GET / redirects to the login page for anonymous visitors', async () => {
      // Regression: '/' used to be unhandled and returned 404, which made the
      // deployed base URL look unreachable.
      const res = await request(app).get('/');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/login');
    });

    test('GET /dashboard redirects anonymous HTML visitors to the login page', async () => {
      const res = await request(app).get('/dashboard').set('Accept', 'text/html');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/login');
    });

    test('POST /call/answer is routed, not 404', async () => {
      // Regression: the application's answer URL is configured with
      // http_method POST, but only GET was implemented, so Vonage received a
      // 404 and dropped every inbound call instantly. Reaching the handler
      // proves the route exists; a missing conversation_uuid is then a 400.
      const res = await request(app).post('/call/answer').send({});
      expect(res.status).not.toBe(404);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/conversation_uuid/);
    });

    test('POST /event accepts Vonage call events', async () => {
      const res = await request(app)
        .post('/event')
        .send({ from: '81401234567', to: '447700900000', conversation_uuid: 'CON-abc' });
      expect(res.status).toBe(200);
    });

    test('the Vonage key diagnostic requires authentication', async () => {
      // It reports on credential validity, so it must not be publicly probeable.
      const res = await request(app).get('/_/diagnostics/vonage-key');
      expect(res.status).toBe(401);
    });

    test('the webhook drift diagnostic requires authentication', async () => {
      const res = await request(app).get('/_/diagnostics/vonage-webhooks');
      expect(res.status).toBe(401);
    });
  });
});
