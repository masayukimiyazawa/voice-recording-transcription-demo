/**
 * Test utilities and mock factories
 */

export class MockVonageClient {
  voice = {
    createOutboundCall: jest.fn(),
    sendNCCO: jest.fn(),
  };

  sms = {
    submitSm: jest.fn(),
  };
}

export class MockVonageResponse {
  constructor(
    public uuid: string,
    public conversationUuid: string,
  ) {}
}

export function createMockVonageCall(overrides = {}) {
  return {
    uuid: 'test-call-uuid',
    conversationUuid: 'test-conversation-uuid',
    to: '+1234567890',
    from: '+0987654321',
    direction: 'inbound' as const,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockRecordingWebhook(overrides = {}) {
  return {
    conversationUuid: 'test-conversation-uuid',
    recordingUuid: 'test-recording-uuid',
    recordingUrl: 'https://api.vonage.com/v1/files/test-recording',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockTranscriptionWebhook(overrides = {}) {
  return {
    conversationUuid: 'test-conversation-uuid',
    recordingUuid: 'test-recording-uuid',
    transcriptionUrl: 'https://api.vonage.com/v1/files/test-transcription',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockTranscriptionResponse(overrides = {}) {
  return {
    text: 'This is a test transcription',
    confidence: 0.95,
    ...overrides,
  };
}
