/**
 * Diagnostics endpoints - operational verification of runtime configuration.
 *
 * These are not part of the business API. They exist so that CI (and humans)
 * can confirm that the credentials held by the running instance actually work,
 * which is the failure mode that silently breaks recording downloads.
 */

import { Request, Response } from 'express';
import { config } from '../../shared/config.js';
import { logger } from '../../shared/logger.js';
import { generateVonageJwt } from '../../shared/vonage.client.js';
import { privateKeyMatchesPublicKey, fingerprintPublicKey, derivePublicKeyFromPrivate } from '../../shared/key-fingerprint.js';
import {
  checkVoiceWebhooks,
  type RegisteredVoiceCapability,
} from '../../shared/webhook-expectations.js';

/**
 * Resolve the public base URL used for webhook URLs. Prefers the configured
 * value and otherwise falls back to the inbound request's forwarded headers.
 */
function resolveBaseUrl(req: Request): string {
  if (config.publicBaseUrl) return config.publicBaseUrl;
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  return `${proto}://${host}`;
}

export interface VonageKeyCheckResult {
  ok: boolean;
  keyMatches: boolean;
  applicationId: string;
  privateKeyFingerprint: string;
  registeredKeyFingerprint: string | null;
  authenticatedRequestOk: boolean;
  vonageStatus: number | null;
  checkedAt: string;
}

export class DiagnosticsController {
  /**
   * GET /_/diagnostics/vonage-key
   *
   * Compares the public key derived from the runtime private key against the
   * public key registered on the Vonage application, and additionally performs
   * a real authenticated request to confirm the key is accepted.
   */
  async checkVonageKey(_req: Request, res: Response): Promise<void> {
    const applicationId = config.vonageApplicationId;
    let keyMatches = false;
    let registeredKeyFingerprint: string | null = null;
    let authenticatedRequestOk = false;
    let vonageStatus: number | null = null;
    let privateKeyFingerprint = 'unavailable';

    try {
      privateKeyFingerprint = fingerprintPublicKey(
        derivePublicKeyFromPrivate(config.vonageApplicationPrivateKey),
      );
    } catch (err) {
      logger.error('Failed to derive public key from private key', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Ask Vonage which public key is registered for this application. A 401
    // here is itself the signal that the key is not accepted.
    try {
      const vonageRes = await fetch(
        `https://api-eu.vonage.com/v2/applications/${encodeURIComponent(applicationId)}`,
        { headers: { Authorization: `Bearer ${generateVonageJwt()}` } },
      );
      vonageStatus = vonageRes.status;
      authenticatedRequestOk = vonageRes.ok;

      if (vonageRes.ok) {
        const app = (await vonageRes.json()) as { keys?: { public_key?: string } };
        const registered = app.keys?.public_key;
        if (registered) {
          registeredKeyFingerprint = fingerprintPublicKey(registered);
          keyMatches = privateKeyMatchesPublicKey(config.vonageApplicationPrivateKey, registered);
        }
      }
    } catch (err) {
      logger.error('Vonage key diagnostic request failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const result: VonageKeyCheckResult = {
      ok: keyMatches && authenticatedRequestOk,
      keyMatches,
      applicationId,
      privateKeyFingerprint,
      registeredKeyFingerprint,
      authenticatedRequestOk,
      vonageStatus,
      checkedAt: new Date().toISOString(),
    };

    if (!result.ok) {
      logger.error('Vonage private key diagnostic FAILED', result);
    } else {
      logger.info('Vonage private key diagnostic passed', {
        applicationId,
        privateKeyFingerprint,
      });
    }

    res.status(result.ok ? 200 : 503).json(result);
  }

  /**
   * GET /_/diagnostics/vonage-webhooks
   *
   * Reports whether the Vonage application's voice capability is in a state
   * that can actually serve calls. VCR legitimately manages the answer/event
   * URLs through its own callback router and re-applies them on every deploy,
   * so both that and a direct pointer at this deployment are treated as valid.
   */
  async checkVonageWebhooks(req: Request, res: Response): Promise<void> {
    const applicationId = config.vonageApplicationId;
    const accountId = config.vonageApiKey;
    const baseUrl = resolveBaseUrl(req);

    let capability: RegisteredVoiceCapability | null;
    try {
      const vonageRes = await fetch(
        `https://api-eu.vonage.com/v2/applications/${encodeURIComponent(applicationId)}`,
        { headers: { Authorization: `Bearer ${generateVonageJwt()}` } },
      );

      if (!vonageRes.ok) {
        // Without a valid key the registered config cannot be read. Report it
        // as a failure rather than a false "all clear".
        logger.error('Could not read the Vonage application config', {
          status: vonageRes.status,
        });
        res.status(503).json({
          ok: false,
          mode: 'unknown',
          error: 'Could not read the Vonage application config',
          vonageStatus: vonageRes.status,
          baseUrl,
          applicationId,
        });
        return;
      }

      const app = (await vonageRes.json()) as {
        capabilities?: { voice?: RegisteredVoiceCapability };
      };
      capability = app.capabilities?.voice ?? null;
    } catch (err) {
      logger.error('Vonage webhook check request failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(503).json({
        ok: false,
        mode: 'unknown',
        error: err instanceof Error ? err.message : String(err),
        baseUrl,
        applicationId,
      });
      return;
    }

    const report = checkVoiceWebhooks({ baseUrl, accountId, applicationId, capability });

    if (!report.ok) {
      logger.error('Vonage voice configuration is NOT callable', report);
    } else {
      logger.info('Vonage voice configuration is callable', {
        baseUrl,
        mode: report.mode,
      });
    }

    res.status(report.ok ? 200 : 503).json({
      ...report,
      baseUrl,
      applicationId,
      checkedAt: new Date().toISOString(),
    });
  }
}
