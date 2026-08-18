/**
 * Call Service - NCCO generation and call handling
 */

import { logger } from '../../shared/logger.js';
import { DestinationRepository } from '../destination/destination.repository.js';
import { SettingsRepository } from '../settings/settings.repository.js';
import type { NCCOAction, IncomingCallRequest } from './call.types.js';

const LANGUAGE_SETTING_KEY = 'language';

const TTS_TEXT: Record<string, string> = {
  'ja-JP': 'お電話ありがとうございます。ただいま担当者におつなぎします。このお電話は録音させていただきます。',
  'en-US': 'Thank you for calling. Please hold while we connect you. This call will be recorded.',
};

export class CallService {
  constructor(
    private destinationRepository: DestinationRepository,
    private settingsRepository: SettingsRepository,
  ) {}

  /**
   * Generate NCCO (Nexmo Call Control Objects) for incoming call
   */
  async generateNCCO(conversationUuid: string, _callerId: string, baseUrl: string): Promise<{ ncco: NCCOAction[]; destinationNumber: string }> {
    const destination = await this.destinationRepository.getCurrentDestination();

    if (!destination) {
      throw new Error('No destination number configured');
    }

    // DB から言語設定を取得（Vonage webhook から呼ばれてもセッション不要）
    const language = await this.settingsRepository.get(LANGUAGE_SETTING_KEY) || 'en-US';

    const recordingWebhookUrl = `${baseUrl}/event/recording`;
    const lvn = process.env.VONAGE_LVN || '';
    // Vonage Voice API は + なしの番号を要求する
    const destinationNumber = destination.phoneNumber.replace(/^\+/, '');

    const ttsText = TTS_TEXT[language] || TTS_TEXT['en-US'];

    const ncco: NCCOAction[] = [
      {
        action: 'talk',
        text: ttsText,
        language: language,
        loop: 1,
      } as any,

      // connect と同時に通話全体を録音（endOnSilence を排除して切断を防ぐ）
      {
        action: 'record',
        format: 'mp3',
        split: 'conversation',
        channels: 2,
        eventUrl: [recordingWebhookUrl],
        eventMethod: 'POST',
        beepStart: false,
        transcription: {
          eventUrl: [`${baseUrl}/event/transcription`],
          eventMethod: 'POST',
          language: language,
          sentimentAnalysis: false,
        },
      } as any,

      {
        action: 'connect',
        from: lvn,
        endpoint: [
          {
            type: 'phone',
            number: destinationNumber,
          },
        ],
      } as any,
    ];

    logger.info('Generated NCCO', { conversationUuid, destinationNumber, recordingWebhookUrl, lvn, language, ncco: JSON.stringify(ncco) });

    return { ncco, destinationNumber };
  }

  /**
   * Process incoming call data
   */
  async processIncomingCall(callData: IncomingCallRequest): Promise<any> {
    logger.info('Processing incoming call', {
      conversationUuid: callData.conversation_uuid,
      from: callData.from,
      to: callData.to,
    });

    // Generate NCCO for this call
    const ncco = await this.generateNCCO(callData.conversation_uuid, callData.from, process.env.WEBHOOK_URL || 'http://localhost:3000');

    return {
      ncco,
      conversationUuid: callData.conversation_uuid,
      callUuid: callData.uuid,
    };
  }
}
