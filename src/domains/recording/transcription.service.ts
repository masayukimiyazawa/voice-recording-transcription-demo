/**
 * Transcription Service - fetches and stores transcriptions from Vonage
 */

import { logger } from '../../shared/logger.js';
import { ValidationError } from '../../shared/error.handler.js';
import { RecordingRepository } from './recording.repository.js';
import { generateVonageJwt } from '../../shared/vonage.client.js';

export class TranscriptionService {
  constructor(private recordingRepository: RecordingRepository) {}

  async handleTranscriptionWebhook(webhookData: any): Promise<any> {
    const { conversation_uuid, transcription_url } = webhookData;

    // Vonage から受信したWebhookの全フィールドをログに出力して診断
    logger.info('Transcription webhook full body', { webhookData });

    if (!conversation_uuid || !transcription_url) {
      throw new ValidationError('Missing required transcription webhook fields', {
        provided: Object.keys(webhookData),
      });
    }

    logger.info('Processing transcription webhook', { conversation_uuid });

    // Try to fetch actual transcription text
    const result = await this.fetchTranscriptionData(transcription_url);

    const recording = await this.recordingRepository.updateTranscription(conversation_uuid, {
      transcriptionUrl: transcription_url,
      ...(result?.text && { text: result.text }),
      ...(result?.utterances && { utterances: result.utterances }),
    });

    return recording;
  }

  async fetchTranscriptionData(transcriptionUrl: string): Promise<{ text: string; utterances: any[] } | null> {
    try {
      const jwt = this.getJwt();
      logger.info('Fetching transcription', { transcriptionUrl, hasJwt: !!jwt });

      const response = await fetch(transcriptionUrl, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });

      logger.info('Transcription fetch response', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errText = await response.text();
        logger.warn('Transcription fetch returned non-ok status', { status: response.status, body: errText });
        return null;
      }

      const rawText = await response.text();
      logger.info('Transcription raw response', { rawText: rawText.substring(0, 500) });

      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        // プレーンテキストの場合はそのまま返す
        return rawText ? { text: rawText, utterances: [] } : null;
      }

      // Vonage フォーマット: { channels: [{ transcript: [{ sentence, timestamp, duration }] }] }
      let transcript: string | null = null;
      let utterances: Array<{ sentence: string; timestamp: number; duration: number; speaker: number }> | undefined;

      if (data?.channels && Array.isArray(data.channels)) {
        const allUtterances: Array<{ sentence: string; timestamp: number; duration: number; speaker: number }> = [];
        const sentences: string[] = [];

        data.channels.forEach((ch: any, chIndex: number) => {
          if (Array.isArray(ch?.transcript)) {
            for (const t of ch.transcript) {
              if (t?.sentence) {
                sentences.push(t.sentence);
                allUtterances.push({
                  sentence: t.sentence,
                  timestamp: t.timestamp ?? 0,
                  duration: t.duration ?? 0,
                  speaker: chIndex,
                });
              }
            }
          }
        });

        // タイムスタンプ順に並べる
        allUtterances.sort((a, b) => a.timestamp - b.timestamp);
        if (allUtterances.length > 0) {
          utterances = allUtterances;
          transcript = sentences.join(' ');
        }
      }

      // フォールバック: 旧フォーマット対応
      if (!transcript) {
        transcript =
          data?.results?.[0]?.alternatives?.[0]?.transcript ??
          data?.text ??
          data?.transcript ??
          null;
      }

      logger.info('Parsed transcript', { transcript });
      if (!transcript) return null;
      return { text: transcript, utterances: utterances || [] };
    } catch (error) {
      logger.warn('Failed to fetch transcription text', { url: transcriptionUrl, error });
      return null;
    }
  }

  private getJwt(): string {
    try {
      return generateVonageJwt();
    } catch (error) {
      logger.warn('Failed to generate JWT token', error);
      return '';
    }
  }
}
