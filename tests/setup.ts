/**
 * Jest setup and test utilities
 */

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.VONAGE_API_KEY = 'test-key';
process.env.VONAGE_API_SECRET = 'test-secret';
process.env.VONAGE_APPLICATION_ID = 'test-app-id';
process.env.VONAGE_PRIVATE_KEY_PATH = './private.key';
process.env.VONAGE_LVN = '+1234567890';
process.env.MONGODB_URI = 'mongodb://localhost:27017/vonage-proxy-test';
process.env.PORTAL_PASSWORD = 'test-password';
process.env.SESSION_SECRET = 'test-session-secret';

export function setupMocks() {
  jest.clearAllMocks();
}

export function teardownMocks() {
  jest.restoreAllMocks();
}
