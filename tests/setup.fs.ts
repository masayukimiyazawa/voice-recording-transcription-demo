/**
 * Intercept fs.readFileSync for private key path in test environment
 */

// Set env vars before config.ts loads
process.env.NODE_ENV = 'test';
process.env.VONAGE_API_KEY = 'test-key';
process.env.VONAGE_API_SECRET = 'test-secret';
process.env.VONAGE_APPLICATION_ID = 'test-app-id';
process.env.VONAGE_PRIVATE_KEY_PATH = './private.key';
process.env.VONAGE_LVN = '+1234567890';
process.env.MONGODB_URI = 'mongodb://localhost:27017/vonage-proxy-test';
process.env.PORTAL_PASSWORD = 'test-password';
process.env.SESSION_SECRET = 'test-session-secret';

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    readFileSync: (path: string, encoding?: any) => {
      if (typeof path === 'string' && path.endsWith('.key')) {
        return '-----BEGIN PRIVATE KEY-----\ntest-private-key\n-----END PRIVATE KEY-----';
      }
      return actual.readFileSync(path, encoding);
    },
  };
});
