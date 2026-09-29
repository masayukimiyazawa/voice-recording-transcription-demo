#!/usr/bin/env node
/**
 * Re-apply the Vonage voice webhooks after a VCR deploy.
 *
 * Why this exists
 * ---------------
 * VCR owns the voice capability of the linked application and re-applies its
 * own callback router to answer_url / event_url / fallback_answer_url on every
 * `vcr deploy`. Verified empirically: restore the URLs via the API, run
 * `vcr deploy` and nothing else, and they are back on the router.
 *
 * The app serves the same routes the router forwards to, so pointing the
 * application straight at this instance is valid and makes the routing
 * explicit. This script restores that state after each deploy.
 *
 * Usage:
 *   node scripts/apply-vonage-webhooks.mjs            # enforce (default)
 *   node scripts/apply-vonage-webhooks.mjs --dry-run  # show the diff only
 *   node scripts/apply-vonage-webhooks.mjs --check    # verify, never write
 *
 * Reads VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_APPLICATION_ID and
 * WEBHOOK_URL from the environment (or .env). Exits non-zero on failure, so it
 * is safe to chain directly after `vcr deploy`.
 */

import fs from 'node:fs';

const REQUIRED = ['VONAGE_API_KEY', 'VONAGE_API_SECRET', 'VONAGE_APPLICATION_ID', 'WEBHOOK_URL'];
const API = 'https://api-eu.vonage.com/v2/applications';
const METHOD = 'POST';

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

function desired(baseUrl) {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    answer_url: `${base}/call/answer`,
    event_url: `${base}/event`,
    fallback_answer_url: `${base}/call/answer`,
  };
}

const stripSlash = (u) => u.replace(/\/+$/, '');

async function fetchApp(auth, appId) {
  const res = await fetch(`${API}/${encodeURIComponent(appId)}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    throw new Error(`GET application failed: HTTP ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Returns the list of human-readable differences; empty means already correct. */
function diff(capability, want) {
  const changes = [];
  if (!capability) return ['voice capability is missing'];

  const webhooks = capability.webhooks ?? {};
  for (const [name, address] of Object.entries(want)) {
    const current = webhooks[name]?.address;
    if (!current || stripSlash(current) !== stripSlash(address)) {
      changes.push(`${name}: ${current ?? '(unset)'} -> ${address}`);
    }
    if ((webhooks[name]?.http_method ?? '').toUpperCase() !== METHOD) {
      changes.push(`${name} http_method: ${webhooks[name]?.http_method ?? '(unset)'} -> ${METHOD}`);
    }
  }
  return changes;
}

async function main() {
  loadDotEnv();

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const checkOnly = args.includes('--check');
  if (args.includes('--help') || args.includes('-h')) {
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*?/, ''));
    return;
  }

  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  const auth = Buffer.from(`${process.env.VONAGE_API_KEY}:${process.env.VONAGE_API_SECRET}`).toString('base64');
  const appId = process.env.VONAGE_APPLICATION_ID;
  const want = desired(process.env.WEBHOOK_URL);

  const app = await fetchApp(auth, appId);
  const capability = app.capabilities?.voice;
  const changes = diff(capability, want);

  console.log(`Application: ${appId}`);
  console.log(`Target base: ${process.env.WEBHOOK_URL.replace(/\/+$/, '')}`);
  console.log('');

  if (changes.length === 0) {
    console.log('OK: webhooks already point at this deployment. Nothing to do.');
    return;
  }

  for (const c of changes) console.log(`  ${c}`);

  if (checkOnly) {
    console.error('\nFAILED: webhooks are not pointed at this deployment.');
    process.exit(1);
  }
  if (dryRun) {
    console.log('\nDry run: no changes written.');
    return;
  }

  // Read-modify-write: only the voice webhook addresses change, so the rest of
  // the application (key, region, signed_callbacks, other capabilities) is
  // preserved exactly as it is now.
  const next = structuredClone(app.capabilities);
  for (const [name, address] of Object.entries(want)) {
    next.voice.webhooks[name] = { ...next.voice.webhooks[name], address, http_method: METHOD };
  }

  const res = await fetch(`${API}/${encodeURIComponent(appId)}`, {
    method: 'PUT',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: app.name,
      capabilities: next,
      privacy: app.privacy ?? {},
      keys: app.keys ?? undefined,
    }),
  });

  if (!res.ok) {
    console.error(`\nPUT failed: HTTP ${res.status}`);
    console.error(await res.text());
    process.exit(1);
  }

  // Read back rather than trusting the write.
  const after = diff((await fetchApp(auth, appId)).capabilities?.voice, want);
  if (after.length) {
    console.error('\nFAILED: webhooks still do not match after the update:');
    for (const c of after) console.error(`  ${c}`);
    process.exit(1);
  }

  console.log('\nOK: webhooks applied and verified.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
