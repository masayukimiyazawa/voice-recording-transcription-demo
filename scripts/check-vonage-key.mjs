#!/usr/bin/env node
/**
 * Verify the deployed instance against the Vonage application:
 *
 *  1. the runtime private key matches the registered public key
 *  2. the voice configuration can actually serve calls (VCR's callback router
 *     and a direct pointer at this instance are both valid; a GET-only app,
 *     a missing capability or an unroutable host are not)
 *
 * Mirrors .github/workflows/vonage-key-check.yml so the same check can be run
 * locally before/after a key rotation or deployment.
 *
 * Usage:
 *   node scripts/check-vonage-key.mjs
 *
 * Reads APP_BASE_URL and PORTAL_PASSWORD from the environment (or .env).
 * Exits non-zero on failure.
 */

import fs from 'node:fs';

const REQUIRED = ['APP_BASE_URL', 'PORTAL_PASSWORD'];

function loadDotEnv() {
  if (!fs.existsSync('.env')) return;
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    if (!(key in process.env)) process.env[key] = trimmed.slice(i + 1).trim();
  }
}

async function main() {
  loadDotEnv();

  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(2);
  }

  const base = process.env.APP_BASE_URL.replace(/\/$/, '');
  const jar = fs.mkdtempSync('/tmp/vonage-key-check-');

  // Log in so the diagnostics endpoint is reachable; it is behind the session.
  const login = await fetch(`${base}/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password: process.env.PORTAL_PASSWORD }),
  });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  if (login.status !== 302 || !cookie) {
    console.error(`Portal login failed (HTTP ${login.status}). Check PORTAL_PASSWORD.`);
    process.exit(1);
  }

  const res = await fetch(`${base}/_/diagnostics/vonage-key`, {
    headers: { Cookie: cookie },
  });
  const body = await res.json().catch(() => ({}));

  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(body, null, 2));

  if (res.status !== 200 || !body.ok || !body.keyMatches) {
    console.error('\nFAILED: the runtime private key does not match the registered application key.');
    console.error('Fix:');
    console.error('  vcr secret update --name VONAGE_PRIVATE_KEY --filename private.key');
    console.error('  vcr deploy');
    process.exit(1);
  }

  console.log(`\nOK: key matches (${body.privateKeyFingerprint})`);

  // --- webhook drift -----------------------------------------------------
  const whRes = await fetch(`${base}/_/diagnostics/vonage-webhooks`, {
    headers: { Cookie: cookie },
  });
  const wh = await whRes.json().catch(() => ({}));

  console.log(`\n--- webhook check: HTTP ${whRes.status} ---`);
  console.log(JSON.stringify(wh, null, 2));

  if (whRes.status !== 200 || !wh.ok) {
    console.error('\nFAILED: the Vonage voice configuration cannot serve calls.');
    for (const problem of wh.problems ?? []) console.error(`  - ${problem}`);
    for (const w of wh.webhooks ?? []) {
      if (!w.ok) console.error(`  ${w.name}\n    expected: ${w.expected}\n    actual  : ${w.actual}`);
    }
    process.exit(1);
  }

  console.log(`\nOK: voice config is callable (mode: ${wh.mode}, base: ${wh.baseUrl})`);
  fs.rmSync(jar, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
