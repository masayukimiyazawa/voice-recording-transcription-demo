/**
 * Recording domain types
 */

export interface RecordingMetadata {
  conversationUuid: string;
  recordingUuid: string;
  callerId: string;
  destinationId: string;
  recordingUrl: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface TranscriptionData {
  transcriptionUrl: string;
  text?: string;
  utterances?: Array<{ sentence: string; timestamp: number; duration: number; speaker: number }>;
  retrievedAt: Date;
}
