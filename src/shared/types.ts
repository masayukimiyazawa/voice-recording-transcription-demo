/**
 * Global TypeScript types and interfaces
 */

export interface CallWebhook {
  conversation_uuid: string;
  uuid: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  timestamp: string;
}

export interface RecordingWebhook {
  conversation_uuid: string;
  recording_uuid: string;
  recording_url: string;
  timestamp: string;
}

export interface TranscriptionWebhook {
  conversation_uuid: string;
  recording_uuid: string;
  transcription_url: string;
  timestamp: string;
}

export interface CallSession {
  userId?: string;
  authenticated: boolean;
}

export interface AuthenticatedRequest {
  session: CallSession;
}
