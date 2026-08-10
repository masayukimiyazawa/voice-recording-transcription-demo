/**
 * Call domain types and NCCO definitions
 */

// NCCO Action types
export interface NCCOTalkAction {
  action: 'talk';
  text: string;
  bargeIn?: boolean;
  loop?: number;
  level?: number;
}

export interface NCCORecordAction {
  action: 'record';
  format?: 'wav' | 'mp3' | 'ulaw';
  channels?: 1 | 2;
  split?: 'conversation';
  eventUrl?: string[];
  endOnSilence?: number;
  eventMethod?: 'GET' | 'POST';
}

export interface NCCOConnectAction {
  action: 'connect';
  endpoint: [
    {
      type: 'phone';
      number: string;
    },
  ];
  eventUrl?: string[];
  eventMethod?: 'GET' | 'POST';
}

export type NCCOAction = NCCOTalkAction | NCCORecordAction | NCCOConnectAction;

export interface IncomingCallRequest {
  to: string;
  from: string;
  conversation_uuid: string;
  uuid: string;
  timestamp: string;
}

export interface CallMetadata {
  conversationUuid: string;
  callUuid: string;
  from: string;
  to: string;
  timestamp: Date;
}
