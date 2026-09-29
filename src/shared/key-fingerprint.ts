/**
 * Key fingerprint helpers.
 *
 * Used by the diagnostics endpoint to detect a rotated-key mismatch: if the
 * private key held by the runtime no longer corresponds to the public key
 * registered on the Vonage application, every authenticated Vonage request
 * fails with 401 and recording/transcription downloads break.
 */

import { createHash, createPublicKey } from 'node:crypto';

/**
 * Normalise a PEM public key so that formatting differences (line endings,
 * trailing newline) do not produce a false mismatch.
 */
export function normalizePublicKey(pem: string): string {
  return pem.replace(/\r\n/g, '\n').trim();
}

/**
 * Derive the SPKI public key PEM from a private key PEM.
 * Throws when the private key cannot be parsed.
 */
export function derivePublicKeyFromPrivate(privateKeyPem: string): string {
  return createPublicKey(privateKeyPem).export({ type: 'spki', format: 'pem' }).toString();
}

/**
 * Short, stable identifier for a key, safe to log and display.
 * Only a prefix of the SHA-256 digest is exposed; this is not a secret.
 */
export function fingerprintPublicKey(publicKeyPem: string): string {
  return createHash('sha256').update(normalizePublicKey(publicKeyPem)).digest('base64').slice(0, 16);
}

/**
 * True when the private key corresponds to the given registered public key.
 */
export function privateKeyMatchesPublicKey(privateKeyPem: string, registeredPublicKeyPem: string): boolean {
  try {
    return (
      fingerprintPublicKey(derivePublicKeyFromPrivate(privateKeyPem)) ===
      fingerprintPublicKey(registeredPublicKeyPem)
    );
  } catch {
    // An unparsable private key can never match; treat as mismatch rather than
    // letting the diagnostics endpoint throw.
    return false;
  }
}
