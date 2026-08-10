/**
 * MongoDB and Mongoose test mocks
 */

export function createMockRecording(overrides = {}) {
  return {
    _id: 'test-recording-id',
    conversationUuid: 'test-conversation-uuid',
    recordingUuid: 'test-recording-uuid',
    callerId: '+1234567890',
    destinationId: '+0987654321',
    recordingUrl: 'https://api.vonage.com/v1/files/test-recording',
    transcription: {
      transcriptionUrl: 'https://api.vonage.com/v1/files/test-transcription',
      text: 'Test transcription',
      retrievedAt: new Date(),
    },
    status: 'completed' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockDestination(overrides = {}) {
  return {
    _id: 'test-destination-id',
    phoneNumber: '+0987654321',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockUser(overrides = {}) {
  return {
    _id: 'test-user-id',
    email: 'admin@example.com',
    password: '$2b$10$...', // hashed password
    createdAt: new Date(),
    ...overrides,
  };
}

export const mockMongooseConnect = jest.fn().mockResolvedValue(undefined);
export const mockMongooseDisconnect = jest.fn().mockResolvedValue(undefined);

export const mockMongooseMethods = {
  connect: mockMongooseConnect,
  disconnect: mockMongooseDisconnect,
};
