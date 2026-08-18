/**
 * Recording model and schema definitions
 */

import { Schema, Document, model } from 'mongoose';

export interface ITranscriptUtterance {
  sentence: string;
  timestamp: number;
  duration: number;
  speaker: number;
}

export interface IRecording extends Document {
  conversationUuid: string;
  recordingUuid: string;
  callerId: string;
  destinationId: string;
  recordingUrl: string;
  status: 'pending' | 'completed' | 'failed';
  transcription?: {
    transcriptionUrl: string;
    text?: string;
    utterances?: ITranscriptUtterance[];
    retrievedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const recordingSchema = new Schema<IRecording>(
  {
    conversationUuid: { type: String, required: true, unique: true, index: true },
    recordingUuid: { type: String, required: true },
    callerId: { type: String, required: true },
    destinationId: { type: String, required: true },
    recordingUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    transcription: {
      transcriptionUrl: { type: String },
      text: { type: String },
      utterances: { type: Schema.Types.Mixed },
      retrievedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  },
);

// Create compound index for querying call history
recordingSchema.index({ createdAt: -1, callerId: 1 });

export const Recording = model<IRecording>('Recording', recordingSchema);
