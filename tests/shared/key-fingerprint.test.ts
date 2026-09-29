/**
 * Key fingerprint tests
 *
 * These guard the CI check that detects a rotated/stale Vonage private key.
 */

import { generateKeyPairSync } from 'node:crypto';
import {
  derivePublicKeyFromPrivate,
  fingerprintPublicKey,
  normalizePublicKey,
  privateKeyMatchesPublicKey,
} from '../../src/shared/key-fingerprint.js';

describe('key fingerprint', () => {
  const pairA = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pairB = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privA = pairA.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const pubA = pairA.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const pubB = pairB.publicKey.export({ type: 'spki', format: 'pem' }).toString();

  describe('normalizePublicKey', () => {
    test('removes CRLF line endings', () => {
      expect(normalizePublicKey(pubA.replace(/\n/g, '\r\n'))).toBe(normalizePublicKey(pubA));
    });

    test('trims surrounding whitespace', () => {
      expect(normalizePublicKey(`\n${pubA}\n`)).toBe(normalizePublicKey(pubA));
    });
  });

  describe('fingerprintPublicKey', () => {
    test('is stable for equivalent keys', () => {
      expect(fingerprintPublicKey(pubA)).toBe(fingerprintPublicKey(`\n${pubA.trim()}\n`));
    });

    test('differs for different keys', () => {
      expect(fingerprintPublicKey(pubA)).not.toBe(fingerprintPublicKey(pubB));
    });
  });

  describe('privateKeyMatchesPublicKey', () => {
    test('detects a matching key pair', () => {
      expect(privateKeyMatchesPublicKey(privA, pubA)).toBe(true);
    });

    test('detects a rotated key (the CI failure mode)', () => {
      // The runtime still holds the old private key while Vonage has a new
      // public key registered: this is exactly the 401 scenario.
      expect(privateKeyMatchesPublicKey(privA, pubB)).toBe(false);
    });

    test('returns false rather than throwing on an unparsable key', () => {
      expect(privateKeyMatchesPublicKey('not-a-key', pubA)).toBe(false);
    });
  });

  describe('derivePublicKeyFromPrivate', () => {
    test('produces a PEM that matches the paired public key', () => {
      expect(normalizePublicKey(derivePublicKeyFromPrivate(privA))).toBe(normalizePublicKey(pubA));
    });
  });
});
