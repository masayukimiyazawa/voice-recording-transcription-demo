/**
 * Voice webhook health checks.
 *
 * Background
 * ----------
 * VCR owns the voice capability of the linked Vonage application. Every
 * `vcr deploy` re-applies VCR's own callback router as the answer/event URL,
 * so those URLs are NOT drift -- they are the platform's intended state.
 * Pointing the application straight at the instance also works, because the
 * app serves the same routes the router forwards to.
 *
 * Both are therefore accepted. What must never be true is the set of
 * conditions that actually broke production:
 *
 *   - the voice capability is missing entirely
 *   - a webhook points somewhere unroutable
 *   - the router is aimed at a different account / application / action
 *   - `http_method` is not POST (the router POSTs; a GET-only app 404s and the
 *     call rings once, then drops)
 *   - `signed_callbacks` is disabled
 */

export type WebhookName = 'answer_url' | 'event_url' | 'fallback_answer_url';

export const WEBHOOK_NAMES: readonly WebhookName[] = [
  'answer_url',
  'event_url',
  'fallback_answer_url',
] as const;

const VCR_ROUTER_HOST = /^callback-router\..*\.runtime\.vonage\.cloud$/i;

/** The action the VCR router uses for each webhook. */
const ROUTER_ACTION: Record<WebhookName, string> = {
  answer_url: 'vapi-answer-callback',
  fallback_answer_url: 'vapi-answer-callback',
  event_url: 'vapi-event-callback',
};

export interface RegisteredWebhook {
  address?: string;
  http_method?: string;
}

export interface RegisteredVoiceCapability {
  webhooks?: Partial<Record<WebhookName, RegisteredWebhook | null>>;
  signed_callbacks?: boolean;
}

export interface ExpectedWebhooks {
  answerUrl: string;
  eventUrl: string;
  fallbackAnswerUrl: string;
}

/** The webhook addresses this deployment serves directly. */
export function expectedWebhooks(baseUrl: string): ExpectedWebhooks {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    answerUrl: `${base}/call/answer`,
    eventUrl: `${base}/event`,
    fallbackAnswerUrl: `${base}/call/answer`,
  };
}

export type WebhookState = 'direct' | 'vcr-router' | 'invalid' | 'missing';

export interface WebhookEntry {
  name: WebhookName;
  expected: string;
  actual: string | null;
  state: WebhookState;
  ok: boolean;
  problem?: string;
}

export interface WebhookHealthReport {
  ok: boolean;
  mode: 'direct' | 'vcr-callback-router' | 'unknown';
  /** Conditions that break call handling. */
  problems: string[];
  /** Worth fixing, but not breaking calls. */
  warnings: string[];
  httpMethod: string | null;
  signedCallbacks: boolean;
  webhooks: WebhookEntry[];
}

export interface CheckOptions {
  /** Public base URL of this deployment. */
  baseUrl: string;
  /** Vonage account id, used to validate the VCR router target. */
  accountId?: string;
  applicationId?: string;
  /** undefined/null when the voice capability is absent. */
  capability: RegisteredVoiceCapability | null | undefined;
}

export function checkVoiceWebhooks(options: CheckOptions): WebhookHealthReport {
  const { baseUrl, accountId, applicationId, capability } = options;
  const expected = expectedWebhooks(baseUrl);
  const problems: string[] = [];

  if (!capability) {
    return {
      ok: false,
      mode: 'unknown',
      problems: ['voice capability is missing from the Vonage application'],
      warnings: [],
      httpMethod: null,
      signedCallbacks: false,
      webhooks: WEBHOOK_NAMES.map((name) => ({
        name,
        expected: urlFor(expected, name),
        actual: null,
        state: 'missing' as const,
        ok: false,
        problem: 'voice capability missing',
      })),
    };
  }

  const warnings: string[] = [];

  // http_method lives on each webhook entry, not on the capability.
  const httpMethod = capability.webhooks?.answer_url?.http_method ?? null;
  if ((httpMethod ?? '').toUpperCase() !== 'POST') {
    problems.push(
      `answer_url http_method is ${httpMethod ?? 'unset'}; must be POST (the VCR router POSTs, so a GET-only answer route 404s and the call rings then drops)`,
    );
  }

  // Not a call-handling failure: this app does not verify callback signatures
  // yet, so the setting is surfaced as a warning rather than enforced.
  const signedCallbacks = capability.signed_callbacks === true;
  if (!signedCallbacks) {
    warnings.push(
      'voice signed_callbacks is disabled; inbound callbacks are not signed. This app does not verify signatures yet, so enabling it alone adds no protection.',
    );
  }

  const webhooks: WebhookEntry[] = WEBHOOK_NAMES.map((name) =>
    classify(name, urlFor(expected, name), capability.webhooks?.[name]?.address ?? null, {
      accountId,
      applicationId,
    }),
  );

  for (const w of webhooks) {
    if (w.problem) problems.push(`${w.name}: ${w.problem}`);
  }

  const good = webhooks.filter((w) => w.ok);
  const mode: WebhookHealthReport['mode'] = good.length === 0
    ? 'unknown'
    : good.every((w) => w.state === 'direct')
      ? 'direct'
      : good.every((w) => w.state === 'vcr-router')
        ? 'vcr-callback-router'
        : 'unknown';

  return {
    ok: problems.length === 0,
    mode,
    problems,
    warnings,
    httpMethod,
    signedCallbacks,
    webhooks,
  };
}

function urlFor(expected: ExpectedWebhooks, name: WebhookName): string {
  return name === 'event_url' ? expected.eventUrl : expected.answerUrl;
}

function classify(
  name: WebhookName,
  expected: string,
  actual: string | null,
  ctx: { accountId?: string; applicationId?: string },
): WebhookEntry {
  const base: WebhookEntry = { name, expected, actual, state: 'invalid', ok: false };

  if (!actual) {
    return { ...base, state: 'missing', problem: 'no address registered' };
  }

  if (stripTrailingSlash(actual) === stripTrailingSlash(expected)) {
    return { ...base, state: 'direct', ok: true };
  }

  const routerProblem = checkRouterTarget(actual, name, ctx);
  if (routerProblem === null) {
    return { ...base, state: 'vcr-router', ok: true };
  }

  return { ...base, problem: routerProblem };
}

/** Returns null when the URL is a valid VCR router target, else the problem. */
function checkRouterTarget(
  url: string,
  name: WebhookName,
  ctx: { accountId?: string; applicationId?: string },
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `not a valid URL and does not match this deployment: ${url}`;
  }

  if (!VCR_ROUTER_HOST.test(parsed.hostname)) {
    return `points to an unroutable host ${parsed.hostname}; expected this deployment or the VCR callback router`;
  }

  if (parsed.searchParams.get('action') !== ROUTER_ACTION[name]) {
    return `VCR router action is ${parsed.searchParams.get('action')}, expected ${ROUTER_ACTION[name]}`;
  }

  const appId = parsed.searchParams.get('apiApplicationId');
  if (ctx.applicationId && appId && appId !== ctx.applicationId) {
    return `VCR router targets a different application (${appId})`;
  }

  const accountId = parsed.searchParams.get('apiAccountId');
  if (ctx.accountId && accountId && accountId !== ctx.accountId) {
    return `VCR router targets a different account (${accountId})`;
  }

  return null;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
