#!/usr/bin/env node
/**
 * CLI: fetch nearby businesses from Google Places API New, write snapshot to
 * content/businesses-snapshot.json. Useful for local dev and one-shot manual
 * refreshes. The Vercel cron in api/refresh-businesses.js does the same thing
 * but writes to Upstash and triggers a redeploy.
 *
 * Usage:
 *   npm run fetch-businesses   (uses .env.local for GOOGLE_PLACES_API_KEY)
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAllBusinesses, buildSnapshot, DEFAULT_BLOCKED_PLACE_IDS } from './lib/places-fetch.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SNAPSHOT_PATH = join(ROOT, 'content/businesses-snapshot.json');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error('ERROR: GOOGLE_PLACES_API_KEY not set.');
  console.error('Set it in .env.local then re-run: npm run fetch-businesses');
  process.exit(2);
}

async function main() {
  console.log('Fetching businesses from Google Places API...');
  const businesses = await fetchAllBusinesses({
    apiKey: API_KEY,
    blockedIds: DEFAULT_BLOCKED_PLACE_IDS,
    log: msg => console.log(msg),
  });
  const snapshot = buildSnapshot(businesses, DEFAULT_BLOCKED_PLACE_IDS.size);
  await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  console.log(`\n✓ Wrote ${businesses.length} businesses to ${SNAPSHOT_PATH}`);
}

main().catch(err => {
  console.error('Fetch failed:', err);
  process.exit(1);
});
