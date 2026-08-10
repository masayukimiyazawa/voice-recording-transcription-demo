/**
 * End-to-end call flow validation
 * Simulates: inbound call → recording webhook → transcription webhook
 */

import '../setup.js';
import { CallService } from '../../src/domains/call/call.service.js';
import { RecordingService } from '../../src/domains/recording/recording.service.js';
import { TranscriptionService } from '../../src/domains/recording/transcription.service.js';
import { RecordingRepository } from '../../src/domains/recording/recording.repository.js';
import { DestinationRepository } from '../../src/domains/destination/destination.repository.js';

jest.mock('../../src/domains/recording/recording.repository.js');
jest.mock('../../src/domains/destination/destination.repository.js');

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('End-to-End Call Flow', () => {
  let callService: CallService;
  let recordingService: RecordingService;
  let transcriptionService: TranscriptionService;
  let mockRecordingRepo: jest.Mocked<RecordingRepository>;
  let mockDestRepo: jest.Mocked<DestinationRepository>;

  const conversationUuid = 'e2e-test-uuid';
  const recordingUuid = 'e2e-rec-uuid';
  const callerNumber = '+15551234567';
  const destNumber = '+15559876543';

  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordingRepo = new RecordingRepository() as jest.Mocked<RecordingRepository>;
    mockDestRepo = new DestinationRepository() as jest.Mocked<DestinationRepository>;

    callService = new CallService(mockDestRepo);
    recordingService = new RecordingService(mockRecordingRepo);
    transcriptionService = new TranscriptionService(mockRecordingRepo);
  });

  test('complete call lifecycle: answer → recording → transcription', async () => {
    // Step 1: Answer call - generate NCCO
    mockDestRepo.getCurrentDestination.mockResolvedValue({
      phoneNumber: destNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await callService.generateNCCO(conversationUuid, callerNumber, 'https://example.com');
    const ncco = result.ncco;

    expect(Array.isArray(ncco)).toBe(true);
    expect(ncco.some((a: any) => a.action === 'record')).toBe(true);
    expect(ncco.some((a: any) => a.action === 'connect')).toBe(true);

    // Step 2: Recording webhook arrives
    const recordingWebhook = {
      conversation_uuid: conversationUuid,
      recording_uuid: recordingUuid,
      recording_url: 'https://api.vonage.com/v1/files/recording',
      caller_id: callerNumber,
      destination_id: destNumber,
    };

    const storedRecording = {
      _id: 'db-id',
      conversationUuid,
      recordingUuid,
      callerId: callerNumber,
      destinationId: destNumber,
      status: 'completed',
    };

    mockRecordingRepo.upsertRecordingMetadata.mockResolvedValue(storedRecording as any);

    const recording = await recordingService.handleRecordingWebhook(recordingWebhook);
    expect(recording._id).toBe('db-id');
    expect(mockRecordingRepo.upsertRecordingMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        callerId: callerNumber,
        destinationId: destNumber,
        status: 'completed',
      }),
    );

    // Step 3: Transcription webhook arrives
    const transcriptionText = 'Hello, this is the call transcription.';
    const transcriptionWebhook = {
      conversation_uuid: conversationUuid,
      transcription_url: 'https://api.vonage.com/v1/files/transcription',
    };

    // fetchTranscriptionData が channels フォーマットを返す形式に更新
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        channels: [{ transcript: [{ sentence: transcriptionText, timestamp: 0, duration: 1000 }] }],
      }),
    });

    const updatedRecording = {
      _id: 'db-id',
      conversationUuid,
      transcription: {
        text: transcriptionText,
        transcriptionUrl: transcriptionWebhook.transcription_url,
      },
    };

    mockRecordingRepo.updateTranscription.mockResolvedValue(updatedRecording as any);

    const finalRecording = await transcriptionService.handleTranscriptionWebhook(transcriptionWebhook);

    expect(mockRecordingRepo.updateTranscription).toHaveBeenCalledWith(
      conversationUuid,
      expect.objectContaining({
        transcriptionUrl: transcriptionWebhook.transcription_url,
        text: transcriptionText,
      }),
    );
    expect(finalRecording.transcription.text).toBe(transcriptionText);
  });

  test('should handle call without transcription fetch failure gracefully', async () => {
    const transcriptionWebhook = {
      conversation_uuid: conversationUuid,
      transcription_url: 'https://api.vonage.com/v1/files/transcription',
    };

    // Fetch fails but service should still store the URL
    mockFetch.mockRejectedValue(new Error('Network error'));
    mockRecordingRepo.updateTranscription.mockResolvedValue({ _id: 'id' } as any);

    await expect(
      transcriptionService.handleTranscriptionWebhook(transcriptionWebhook),
    ).resolves.toBeDefined();

    // Should still update with at least the URL
    expect(mockRecordingRepo.updateTranscription).toHaveBeenCalledWith(
      conversationUuid,
      expect.objectContaining({ transcriptionUrl: transcriptionWebhook.transcription_url }),
    );
  });
});
