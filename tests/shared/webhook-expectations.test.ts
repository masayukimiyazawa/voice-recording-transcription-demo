/**
 * Voice webhook health tests
 *
 * These encode what actually broke production, so the CI check does not simply
 * assert one exact URL shape:
 *   - VCR's callback router is re-applied by `vcr deploy` and is a valid state
 *   - a GET-only app is NOT: the router POSTs, the route 404s, the call drops
 */

import {
  checkVoiceWebhooks,
  expectedWebhooks,
  type RegisteredVoiceCapability,
} from '../../src/shared/webhook-expectations.js';

const BASE = 'https://app-instance.example.com';
const APP_ID = '11111111-2222-3333-4444-555555555555';
const ACCOUNT_ID = 'abcdef12';

const router = (action: string, appId = APP_ID, accountId = ACCOUNT_ID) =>
  `https://callback-router.apse1.runtime.vonage.cloud/?provider=vonage-voice&action=${action}` +
  `&apiApplicationId=${appId}&apiAccountId=${accountId}`;

const check = (capability: RegisteredVoiceCapability | null, baseUrl = BASE) =>
  checkVoiceWebhooks({ baseUrl, accountId: ACCOUNT_ID, applicationId: APP_ID, capability });

describe('expectedWebhooks', () => {
  test('derives the deployment routes', () => {
    expect(expectedWebhooks(BASE)).toEqual({
      answerUrl: `${BASE}/call/answer`,
      eventUrl: `${BASE}/event`,
      fallbackAnswerUrl: `${BASE}/call/answer`,
    });
  });

  test('normalises a trailing slash', () => {
    expect(expectedWebhooks(`${BASE}/`).eventUrl).toBe(`${BASE}/event`);
  });
});

describe('checkVoiceWebhooks', () => {
  const healthy = (overrides: Partial<RegisteredVoiceCapability> = {}): RegisteredVoiceCapability => ({
    webhooks: {
      answer_url: { address: `${BASE}/call/answer`, http_method: 'POST' },
      event_url: { address: `${BASE}/event`, http_method: 'POST' },
      fallback_answer_url: { address: `${BASE}/call/answer`, http_method: 'POST' },
    },
    signed_callbacks: true,
    ...overrides,
  });

  describe('accepted states', () => {
    test('direct pointers at this deployment are healthy', () => {
      const report = check(healthy());
      expect(report.ok).toBe(true);
      expect(report.mode).toBe('direct');
      expect(report.problems).toEqual([]);
    });

    test('the VCR callback router (what every deploy re-applies) is healthy', () => {
      const report = check(healthy({
        webhooks: {
          answer_url: { address: router('vapi-answer-callback'), http_method: 'POST' },
          event_url: { address: router('vapi-event-callback'), http_method: 'POST' },
          fallback_answer_url: { address: router('vapi-answer-callback'), http_method: 'POST' },
        },
      }));

      expect(report.ok).toBe(true);
      expect(report.mode).toBe('vcr-callback-router');
    });

    test('a mix of direct and router is tolerated', () => {
      const report = check(healthy({
        webhooks: {
          answer_url: { address: `${BASE}/call/answer`, http_method: 'POST' },
          event_url: { address: router('vapi-event-callback'), http_method: 'POST' },
          fallback_answer_url: { address: router('vapi-answer-callback'), http_method: 'POST' },
        },
      }));

      expect(report.ok).toBe(true);
    });

    test('a trailing slash on a direct pointer is tolerated', () => {
      const report = check(healthy({
        webhooks: {
          answer_url: { address: `${BASE}/call/answer/`, http_method: 'POST' },
          event_url: { address: `${BASE}/event`, http_method: 'POST' },
          fallback_answer_url: { address: `${BASE}/call/answer`, http_method: 'POST' },
        },
      }));

      expect(report.ok).toBe(true);
    });
  });

  describe('the failures that actually break calls', () => {
    test('a missing voice capability fails', () => {
      const report = check(null);
      expect(report.ok).toBe(false);
      expect(report.problems[0]).toMatch(/voice capability is missing/);
    });

    test('http_method GET fails (router POSTs, so a GET-only app drops calls)', () => {
      const report = check(healthy({
        webhooks: {
          answer_url: { address: `${BASE}/call/answer`, http_method: 'GET' },
          event_url: { address: `${BASE}/event`, http_method: 'GET' },
          fallback_answer_url: { address: `${BASE}/call/answer`, http_method: 'GET' },
        },
      }));
      expect(report.ok).toBe(false);
      expect(report.problems.join(' ')).toMatch(/http_method is GET; must be POST/);
    });

    test('an unset http_method fails', () => {
      const report = check(healthy({
        webhooks: {
          answer_url: { address: `${BASE}/call/answer` },
          event_url: { address: `${BASE}/event` },
          fallback_answer_url: { address: `${BASE}/call/answer` },
        },
      }));
      expect(report.ok).toBe(false);
    });

    test('disabled signed_callbacks warns but does not fail', () => {
      const report = check(healthy({ signed_callbacks: false }));
      expect(report.ok).toBe(true);
      expect(report.signedCallbacks).toBe(false);
      expect(report.warnings.join(' ')).toMatch(/signed_callbacks is disabled/);
    });

    test('an unroutable host fails', () => {
      const report = check(healthy({
        webhooks: {
          answer_url: { address: 'https://evil.example.com/call/answer' },
          event_url: { address: `${BASE}/event` },
          fallback_answer_url: { address: `${BASE}/call/answer` },
        },
      }));

      expect(report.ok).toBe(false);
      const answer = report.webhooks.find((w) => w.name === 'answer_url')!;
      expect(answer.state).toBe('invalid');
      expect(answer.problem).toMatch(/unroutable host/);
    });

    test('a missing webhook address fails', () => {
      const report = check(healthy({ webhooks: { answer_url: null } }));
      expect(report.ok).toBe(false);
      expect(report.webhooks.find((w) => w.name === 'event_url')!.state).toBe('missing');
    });

    test('a router aimed at another account fails', () => {
      const report = check(healthy({
        webhooks: {
          answer_url: { address: router('vapi-answer-callback', APP_ID, 'deadbeef') },
          event_url: { address: router('vapi-event-callback') },
          fallback_answer_url: { address: router('vapi-answer-callback') },
        },
      }));

      expect(report.ok).toBe(false);
      expect(report.problems.join(' ')).toMatch(/different account/);
    });

    test('a router aimed at another application fails', () => {
      const report = check(healthy({
        webhooks: {
          answer_url: { address: router('vapi-answer-callback', 'ffffffff-0000-0000-0000-000000000000') },
          event_url: { address: router('vapi-event-callback') },
          fallback_answer_url: { address: router('vapi-answer-callback') },
        },
      }));

      expect(report.ok).toBe(false);
      expect(report.problems.join(' ')).toMatch(/different application/);
    });

    test('an answer action on the event webhook fails', () => {
      const report = check(healthy({
        webhooks: {
          answer_url: { address: router('vapi-answer-callback') },
          event_url: { address: router('vapi-answer-callback') },
          fallback_answer_url: { address: router('vapi-answer-callback') },
        },
      }));

      expect(report.ok).toBe(false);
      expect(report.problems.join(' ')).toMatch(/expected vapi-event-callback/);
    });
  });

  test('exposes the values needed for triage', () => {
    const report = check(healthy({ signed_callbacks: true }));
    const answer = report.webhooks.find((w) => w.name === 'answer_url')!;

    expect(answer.expected).toBe(`${BASE}/call/answer`);
    expect(answer.actual).toBe(`${BASE}/call/answer`);
    expect(report.httpMethod).toBe('POST');
    expect(report.signedCallbacks).toBe(true);
  });
});
