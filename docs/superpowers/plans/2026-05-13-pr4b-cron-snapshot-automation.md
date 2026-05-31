# PR 4b — Vercel Cron + Upstash Snapshot Automation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate the businesses snapshot refresh. A nightly Vercel cron job calls Places API server-side, writes to Upstash Redis, and triggers a Vercel Deploy Hook to rebuild. Build script reads snapshot from Upstash with fallback to the committed JSON file.

**Architecture:** Three pieces: (1) Refactor Places fetch logic into a shared lib so both the CLI and serverless function can use it. (2) New Vercel serverless function `api/refresh-businesses.js` that fetches → writes Upstash → triggers Deploy Hook. (3) Build script enhanced to prefer Upstash snapshot over the committed JSON. Vercel Cron schedules the function nightly. Upstash Redis (already in the project for the admin block list) stores the latest snapshot.

**Tech Stack:** Same as PRs 1-4a — Node 20+, vanilla JS, no runtime deps. Adds: Upstash Redis REST API (used HTTP-only via `fetch`), Vercel Cron (config in `vercel.json`), Vercel Deploy Hook URL (created in dashboard, stored as env var).

**Project root:** `/Users/jaimemurillo/Library/Mobile Documents/com~apple~CloudDocs/Projects/web/sjdg-webpage`

**Spec reference:** `docs/superpowers/specs/2026-05-12-seo-overhaul-design.md` — completes PR 4 / Option Y (cron automation half).

**Out of scope for PR 4b:**
- Photo downloads/caching → backlog
- Topic / tourist landing pages → PR 5
- Search Console Domain property + `.org` redirect → PR 6
- Server-restricted API key (covered in deploy steps as a recommendation)

---

## Locked design decisions

1. **Cron schedule:** Daily at 10:00 UTC = 4:00 AM Mexico time (low traffic). Vercel Hobby tier allows daily crons.
2. **Storage:** Upstash Redis (REST API, already in use by `api/blocked-places.js`). Key: `businesses_snapshot`. Value: JSON string of full snapshot. TTL: none (always overwritten).
3. **Build-time read:** Build script attempts Upstash first; on miss/error falls back to `content/businesses-snapshot.json`. Committed JSON serves as the seed and as a safety net if Upstash is down at build time.
4. **Function auth:** Vercel auto-injects `Authorization: Bearer <CRON_SECRET>` for cron-triggered requests. Function rejects requests without a matching secret. Manual triggers from CLI must include the same header.
5. **Deploy Hook:** A Vercel Deploy Hook URL is created in the dashboard, stored as `VERCEL_DEPLOY_HOOK_URL` env var. Function POSTs to it after a successful Upstash write to trigger a rebuild.
6. **Failure mode:** If Places API fails, function returns 500 and does NOT trigger redeploy. Existing snapshot stays in Upstash. Logs surface in Vercel.
7. **Manual trigger:** Function also accepts `?manual=1` query param + bearer token, allowing CLI invocation for testing without waiting for cron.
8. **Fetch script behavior unchanged:** `npm run fetch-businesses` still works — writes to local JSON. Useful for development and as a one-shot manual refresh that bypasses Upstash.

---

## Required Vercel project configuration (controller does this manually after merge)

These must be set in the Vercel dashboard before the cron will work. Documented in PR description.

| Env var | Value source | Notes |
|---------|-------------|-------|
| `GOOGLE_PLACES_API_KEY` | Same as `.env.local` | Server-side. Recommended: create a NEW key restricted to server IPs in GCP, but reusing existing public key works. |
| `UPSTASH_REDIS_REST_URL` | Already set (used by `api/blocked-places.js`) | Verify in Vercel dashboard — likely already there. |
| `UPSTASH_REDIS_REST_TOKEN` | Already set (used by `api/blocked-places.js`) | Verify. |
| `VERCEL_DEPLOY_HOOK_URL` | Create in Vercel dashboard | Settings → Git → Deploy Hooks → "Create Hook" with name "Cron Refresh" and branch `main`. Copy the URL. |
| `CRON_SECRET` | Generate random string | E.g. `openssl rand -hex 32`. Vercel auto-passes this as `Authorization: Bearer <secret>` for cron requests. |

---

## File Structure

**New files:**

| Path | Responsibility |
|------|---------------|
| `scripts/lib/places-fetch.js` | Reusable Places API fetch logic. Pure function `fetchAllBusinesses(apiKey)` returns the full normalized + deduped business list. Used by CLI and by the serverless function. |
| `scripts/lib/snapshot-store.js` | Upstash Redis wrapper. `getSnapshot()` returns parsed JSON or `null`. `putSnapshot(snapshot)` writes. Both no-op silently if env vars missing. |
| `api/refresh-businesses.js` | Vercel serverless function. POST handler. Auth-checks bearer token, fetches via places-fetch.js, writes via snapshot-store.js, triggers Deploy Hook, returns count. |
| `tests/places-fetch.test.js` | Tests the lib's normalization + dedup logic via a mock fetch. |
| `tests/snapshot-store.test.js` | Tests the Upstash wrapper via a mock fetch. |

**Modified files:**

| Path | Change |
|------|--------|
| `scripts/fetch-businesses.js` | Refactor to use `scripts/lib/places-fetch.js`. Optionally also write to Upstash if env vars present. |
| `scripts/build.js` | Read snapshot from Upstash first, fall back to committed JSON. New helper `resolveSnapshot()`. |
| `vercel.json` | Add `crons` array with `/api/refresh-businesses` daily at 10:00 UTC. Add `functions` config to extend timeout if needed (default 10s might be tight for Places API). |
| `tests/build.test.js` | Per-business pages test stays — uses whichever snapshot resolveSnapshot returns. |

**Untouched:** All PR 1-4a templates, content, and per-business page generator. The cron just refreshes data; the rendering pipeline is unchanged.

---

## Pre-flight: Worktree setup (controller responsibility)

```bash
cd "/Users/jaimemurillo/Library/Mobile Documents/com~apple~CloudDocs/Projects/web/sjdg-webpage"
git worktree add .worktrees/pr4b-cron-automation -b feat/pr4b-cron-automation
cd .worktrees/pr4b-cron-automation
rm -rf dist && node scripts/build.js > /dev/null 2>&1 && npm test
```

Baseline: 50 passing.

---

## Task 1: Extract Places fetch logic into reusable lib (TDD)

Move the API + dedup + normalize logic from `scripts/fetch-businesses.js` into `scripts/lib/places-fetch.js`. The CLI and serverless function will both call it.

**Files:**
- Create: `scripts/lib/places-fetch.js`
- Create: `tests/places-fetch.test.js`
- Modify: `scripts/fetch-businesses.js` (replace inline logic with import)

- [ ] **Step 1: Write failing tests**

Create `tests/places-fetch.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlace, dedupeAndBlock } from '../scripts/lib/places-fetch.js';

test('normalizePlace strips "places/" prefix from id', () => {
  const raw = {
    id: 'places/ChIJabc123',
    displayName: { text: 'Test' },
    types: ['restaurant'],
  };
  const n = normalizePlace(raw);
  assert.equal(n.placeId, 'ChIJabc123');
  assert.equal(n.displayName, 'Test');
});

test('normalizePlace builds a slug from name + place_id', () => {
  const n = normalizePlace({
    id: 'places/ChIJabc123def',
    displayName: { text: 'Café Azul' },
  });
  assert.equal(n.slug, 'cafe-azul-3def');
});

test('normalizePlace handles missing fields gracefully', () => {
  const n = normalizePlace({ id: 'places/X' });
  assert.equal(n.placeId, 'X');
  assert.equal(n.displayName, '');
  assert.deepEqual(n.types, []);
});

test('dedupeAndBlock removes duplicates by placeId', () => {
  const list = [
    { placeId: 'A', displayName: 'one' },
    { placeId: 'B', displayName: 'two' },
    { placeId: 'A', displayName: 'one again' },
  ];
  const result = dedupeAndBlock(list, new Set());
  assert.equal(result.length, 2);
  assert.equal(result[0].displayName, 'one');
  assert.equal(result[1].displayName, 'two');
});

test('dedupeAndBlock removes blocked placeIds', () => {
  const list = [
    { placeId: 'A', displayName: 'keep' },
    { placeId: 'B', displayName: 'blocked' },
    { placeId: 'C', displayName: 'keep' },
  ];
  const result = dedupeAndBlock(list, new Set(['B']));
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(b => b.placeId), ['A', 'C']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```
Expected: 5 new tests fail with module-not-found.

- [ ] **Step 3: Implement `scripts/lib/places-fetch.js`**

```javascript
import { businessSlug } from './slugify.js';

export const TOWN_LAT = 20.6748;
export const TOWN_LNG = -102.5705;
export const RADIUS = 5000;

export const CATEGORIES = [
  'restaurant', 'meal_takeaway', 'meal_delivery',
  'bar', 'cafe',
  'store', 'pharmacy', 'bakery',
  'park', 'campground', 'tourist_attraction',
  'lodging',
];

export const DEFAULT_BLOCKED_PLACE_IDS = new Set([
  'ChIJTSyIjZIzKYQRe3ZylqQUV1w', // PUNTO FIT
]);

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.primaryType',
  'places.types',
  'places.formattedAddress',
  'places.location',
  'places.internationalPhoneNumber',
  'places.regularOpeningHours',
  'places.rating',
  'places.userRatingCount',
].join(',');

export function normalizePlace(raw) {
  const placeId = (raw.id || '').replace(/^places\//, '');
  const displayName = raw.displayName?.text || '';
  return {
    placeId,
    displayName,
    primaryType: raw.primaryType,
    types: raw.types || [],
    formattedAddress: raw.formattedAddress,
    location: raw.location,
    internationalPhoneNumber: raw.internationalPhoneNumber,
    regularOpeningHours: raw.regularOpeningHours,
    rating: raw.rating,
    userRatingCount: raw.userRatingCount,
    slug: businessSlug(displayName, placeId),
  };
}

export function dedupeAndBlock(places, blockedIds) {
  const seen = new Map();
  for (const p of places) {
    if (!p.placeId) continue;
    if (blockedIds.has(p.placeId)) continue;
    if (!seen.has(p.placeId)) seen.set(p.placeId, p);
  }
  return [...seen.values()];
}

async function fetchOneCategory(apiKey, type) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: [type],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: TOWN_LAT, longitude: TOWN_LNG },
          radius: RADIUS,
        },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API ${type} returned ${res.status}: ${text}`);
  }
  const json = await res.json();
  return (json.places || []).map(normalizePlace);
}

export async function fetchAllBusinesses({ apiKey, blockedIds = DEFAULT_BLOCKED_PLACE_IDS, log = () => {} }) {
  const all = [];
  for (const type of CATEGORIES) {
    try {
      const places = await fetchOneCategory(apiKey, type);
      log(`  ${type}: ${places.length} results`);
      all.push(...places);
    } catch (err) {
      log(`  ${type}: FAILED — ${err.message}`);
    }
  }
  const businesses = dedupeAndBlock(all, blockedIds)
    .sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0));
  return businesses;
}

export function buildSnapshot(businesses, blockedCount) {
  return {
    fetchedAt: new Date().toISOString(),
    townCenter: { latitude: TOWN_LAT, longitude: TOWN_LNG },
    radius: RADIUS,
    blockedCount,
    count: businesses.length,
    businesses,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```
Expected: All 55 tests pass (50 prior + 5 new).

- [ ] **Step 5: Refactor `scripts/fetch-businesses.js` to use the lib**

Replace the file with:

```javascript
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
```

- [ ] **Step 6: Verify CLI still works (no API call — just dry parse)**

```bash
node -e "import('./scripts/fetch-businesses.js').catch(e => console.log('expected exit:', e?.message || 'API key check'))"
```
Expected: Exits with the API key error or runs cleanly. (Don't actually re-fetch — the snapshot is already current from PR 4a.)

Or: ensure `npm test` still passes (no behavioral regression):
```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/places-fetch.js scripts/fetch-businesses.js tests/places-fetch.test.js
git commit -m "refactor: extract Places API fetch logic into reusable lib"
```

---

## Task 2: Upstash snapshot storage wrapper (TDD)

Tiny wrapper around the Upstash Redis REST API for reading/writing the snapshot.

**Files:**
- Create: `scripts/lib/snapshot-store.js`
- Create: `tests/snapshot-store.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/snapshot-store.test.js`:

```javascript
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { getSnapshot, putSnapshot } from '../scripts/lib/snapshot-store.js';

test('getSnapshot returns null when env vars missing', async () => {
  const result = await getSnapshot({});  // empty env
  assert.equal(result, null);
});

test('putSnapshot is a no-op when env vars missing', async () => {
  // Should not throw.
  const result = await putSnapshot({ count: 0, businesses: [] }, {});
  assert.equal(result.skipped, true);
});

test('getSnapshot fetches from Upstash and parses JSON', async () => {
  const fakeFetch = mock.fn(async (url, opts) => {
    assert.match(url, /\/get\/businesses_snapshot$/);
    assert.equal(opts.headers.Authorization, 'Bearer test-token');
    return {
      ok: true,
      json: async () => ({ result: JSON.stringify({ count: 3, businesses: [{ slug: 'a' }] }) }),
    };
  });
  const result = await getSnapshot({
    UPSTASH_REDIS_REST_URL: 'https://upstash.example.com',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
  }, fakeFetch);
  assert.equal(result.count, 3);
  assert.equal(result.businesses[0].slug, 'a');
  assert.equal(fakeFetch.mock.callCount(), 1);
});

test('getSnapshot returns null when Upstash returns null result', async () => {
  const fakeFetch = mock.fn(async () => ({
    ok: true,
    json: async () => ({ result: null }),
  }));
  const result = await getSnapshot({
    UPSTASH_REDIS_REST_URL: 'https://upstash.example.com',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
  }, fakeFetch);
  assert.equal(result, null);
});

test('getSnapshot returns null and logs on fetch error', async () => {
  const fakeFetch = mock.fn(async () => { throw new Error('network down'); });
  const result = await getSnapshot({
    UPSTASH_REDIS_REST_URL: 'https://upstash.example.com',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
  }, fakeFetch);
  assert.equal(result, null);
});

test('putSnapshot POSTs the JSON to Upstash', async () => {
  let postedBody = null;
  const fakeFetch = mock.fn(async (url, opts) => {
    assert.match(url, /\/set\/businesses_snapshot$/);
    postedBody = opts.body;
    return { ok: true, json: async () => ({ result: 'OK' }) };
  });
  const snapshot = { count: 1, businesses: [{ slug: 'x' }] };
  const result = await putSnapshot(snapshot, {
    UPSTASH_REDIS_REST_URL: 'https://upstash.example.com',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
  }, fakeFetch);
  assert.equal(result.ok, true);
  assert.equal(postedBody, JSON.stringify(snapshot));
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```
Expected: 6 new tests fail with module-not-found.

- [ ] **Step 3: Implement `scripts/lib/snapshot-store.js`**

```javascript
const KEY = 'businesses_snapshot';

function isConfigured(env) {
  return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

export async function getSnapshot(env = process.env, fetchFn = fetch) {
  if (!isConfigured(env)) return null;
  try {
    const res = await fetchFn(`${env.UPSTASH_REDIS_REST_URL}/get/${KEY}`, {
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.result) return null;
    return JSON.parse(json.result);
  } catch (err) {
    // Log to stderr so build script captures it but doesn't fail
    console.error('[snapshot-store] getSnapshot failed:', err.message);
    return null;
  }
}

export async function putSnapshot(snapshot, env = process.env, fetchFn = fetch) {
  if (!isConfigured(env)) return { skipped: true };
  const body = JSON.stringify(snapshot);
  // Upstash REST uses POST with body for SET when value is large
  const res = await fetchFn(`${env.UPSTASH_REDIS_REST_URL}/set/${KEY}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash SET failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  return { ok: json.result === 'OK', result: json.result };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```
Expected: All 61 tests pass (55 prior + 6 new).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/snapshot-store.js tests/snapshot-store.test.js
git commit -m "feat: add Upstash snapshot storage wrapper"
```

---

## Task 3: Build script reads from Upstash with fallback

Modify `scripts/build.js` so the per-business build uses Upstash snapshot when present, falls back to committed JSON when not.

**Files:**
- Modify: `scripts/build.js`

- [ ] **Step 1: Open `scripts/build.js`. Add import near the top:**

```javascript
import { getSnapshot } from './lib/snapshot-store.js';
```

- [ ] **Step 2: Replace the snapshot-loading section in `buildBusinessPages`**

Find the start of `buildBusinessPages`:

```javascript
async function buildBusinessPages({ shared, layout, pageSlugs }) {
  const snapshotPath = join(ROOT, 'content/businesses-snapshot.json');
  if (!existsSync(snapshotPath)) {
    console.log('⊘ skipping per-business pages (snapshot missing — run npm run fetch-businesses)');
    return;
  }
  const snapshot = await loadContent(snapshotPath);
  ...
```

Replace those lines (from the function signature through `const snapshot = await loadContent(snapshotPath);`) with:

```javascript
async function buildBusinessPages({ shared, layout, pageSlugs }) {
  const snapshot = await resolveSnapshot();
  if (!snapshot) {
    console.log('⊘ skipping per-business pages (no snapshot in Upstash or local file — run npm run fetch-businesses)');
    return;
  }
  console.log(`✓ loaded snapshot (${snapshot.count} businesses, fetched ${snapshot.fetchedAt})`);
```

The rest of `buildBusinessPages` (the `for` loops) stays the same.

- [ ] **Step 3: Add the `resolveSnapshot` helper above `buildBusinessPages`**

```javascript
async function resolveSnapshot() {
  // Try Upstash first (production / cron-refreshed).
  const remote = await getSnapshot();
  if (remote) {
    console.log(`✓ using Upstash snapshot (${remote.count} businesses)`);
    return remote;
  }
  // Fall back to committed JSON.
  const localPath = join(ROOT, 'content/businesses-snapshot.json');
  if (existsSync(localPath)) {
    console.log('✓ using local snapshot fallback');
    return loadContent(localPath);
  }
  return null;
}
```

- [ ] **Step 4: Also update the `buildOnePage` slug-map injection to use the resolver**

In `buildOnePage`, the `if (pageName === 'businesses')` block currently reads the snapshot from disk. Update it to use `resolveSnapshot`:

Find:

```javascript
  if (pageName === 'businesses') {
    const snapshotPath = join(ROOT, 'content/businesses-snapshot.json');
    const slugMap = {};
    if (existsSync(snapshotPath)) {
      const snapshot = await loadContent(snapshotPath);
      for (const b of snapshot.businesses) slugMap[b.placeId] = b.slug;
    }
    const json = JSON.stringify(slugMap);
    content.slug_map_json = { en: json, es: json };
  }
```

Replace with:

```javascript
  if (pageName === 'businesses') {
    const snapshot = await resolveSnapshot();
    const slugMap = {};
    if (snapshot) {
      for (const b of snapshot.businesses) slugMap[b.placeId] = b.slug;
    }
    const json = JSON.stringify(slugMap);
    content.slug_map_json = { en: json, es: json };
  }
```

- [ ] **Step 5: Test the build still works (using local fallback since no Upstash env yet)**

```bash
rm -rf dist && node scripts/build.js 2>&1 | grep -E "snapshot|wrote.*per-business"
```

Expected:
```
✓ using local snapshot fallback
✓ loaded snapshot (79 businesses, fetched <date>)
✓ wrote 158 per-business pages (79 businesses × 2 langs)
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```
Expected: All 61 tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/build.js
git commit -m "feat: build reads businesses snapshot from Upstash with local fallback"
```

---

## Task 4: Vercel serverless function for cron-driven refresh

The function that fetches Places, writes Upstash, triggers redeploy.

**Files:**
- Create: `api/refresh-businesses.js`

- [ ] **Step 1: Create `api/refresh-businesses.js`**

```javascript
/**
 * Vercel serverless function — cron-triggered businesses snapshot refresh.
 *
 * Schedule: daily at 10:00 UTC (configured in vercel.json).
 *
 * Required env vars (set in Vercel dashboard):
 *   GOOGLE_PLACES_API_KEY     — Places API key
 *   UPSTASH_REDIS_REST_URL    — Upstash Redis REST endpoint
 *   UPSTASH_REDIS_REST_TOKEN  — Upstash Redis REST token
 *   VERCEL_DEPLOY_HOOK_URL    — POST here after success to trigger rebuild
 *   CRON_SECRET               — Vercel auto-injects as Authorization header for cron
 *
 * Manual invocation (testing):
 *   curl -X POST https://sanjosedegracia.net/api/refresh-businesses \
 *        -H "Authorization: Bearer <CRON_SECRET>"
 */
import { fetchAllBusinesses, buildSnapshot, DEFAULT_BLOCKED_PLACE_IDS } from '../scripts/lib/places-fetch.js';
import { putSnapshot } from '../scripts/lib/snapshot-store.js';

function unauthorized(res, msg) {
  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: msg }));
}

function authorized(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const got = req.headers['authorization'] || '';
  return got === `Bearer ${expected}`;
}

async function triggerDeploy(hookUrl) {
  if (!hookUrl) return { skipped: true, reason: 'no VERCEL_DEPLOY_HOOK_URL' };
  const res = await fetch(hookUrl, { method: 'POST' });
  if (!res.ok) {
    return { ok: false, status: res.status, text: await res.text() };
  }
  return { ok: true, status: res.status };
}

export default async function handler(req, res) {
  // Vercel Cron uses GET (or POST). Both are fine; we just check auth.
  if (!authorized(req)) {
    return unauthorized(res, 'CRON_SECRET required');
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY not set' }));
  }

  const log = (msg) => console.log(`[refresh-businesses] ${msg}`);
  log('Starting businesses snapshot refresh');

  let businesses;
  try {
    businesses = await fetchAllBusinesses({
      apiKey,
      blockedIds: DEFAULT_BLOCKED_PLACE_IDS,
      log,
    });
  } catch (err) {
    log(`FETCH FAILED: ${err.message}`);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'places fetch failed', message: err.message }));
  }

  if (businesses.length === 0) {
    log('No businesses returned — refusing to overwrite snapshot');
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'empty result, snapshot untouched' }));
  }

  const snapshot = buildSnapshot(businesses, DEFAULT_BLOCKED_PLACE_IDS.size);

  try {
    const writeResult = await putSnapshot(snapshot);
    log(`Upstash write: ${JSON.stringify(writeResult)}`);
  } catch (err) {
    log(`UPSTASH WRITE FAILED: ${err.message}`);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'upstash write failed', message: err.message }));
  }

  const deploy = await triggerDeploy(process.env.VERCEL_DEPLOY_HOOK_URL);
  log(`Deploy hook: ${JSON.stringify(deploy)}`);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: true,
    count: snapshot.count,
    fetchedAt: snapshot.fetchedAt,
    deploy,
  }));
}
```

- [ ] **Step 2: No tests for the function itself (it's an integration boundary). Verify imports resolve via:**

```bash
node -e "import('./api/refresh-businesses.js').then(m => console.log('module loaded, default:', typeof m.default))"
```
Expected: `module loaded, default: function`

- [ ] **Step 3: Commit**

```bash
git add api/refresh-businesses.js
git commit -m "feat: serverless function for cron-driven businesses refresh"
```

---

## Task 5: Vercel cron + function config

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Replace `vercel.json`**

Current content (after PR 3):

```json
{
  "cleanUrls": true,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "redirects": [
    { "source": "/", "has": [{ "type": "header", "key": "accept-language", "value": "^es.*" }], "destination": "/es/", "permanent": false },
    { "source": "/", "destination": "/en/", "permanent": false },
    { "source": "/businesses", "destination": "/en/businesses", "permanent": true },
    { "source": "/faq",        "destination": "/en/faq",        "permanent": true },
    { "source": "/tour",       "destination": "/en/tour",       "permanent": true },
    { "source": "/advertise",  "destination": "/en/advertise",  "permanent": true }
  ]
}
```

Replace with (adds `crons` array and `functions` block to extend timeout):

```json
{
  "cleanUrls": true,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "redirects": [
    { "source": "/", "has": [{ "type": "header", "key": "accept-language", "value": "^es.*" }], "destination": "/es/", "permanent": false },
    { "source": "/", "destination": "/en/", "permanent": false },
    { "source": "/businesses", "destination": "/en/businesses", "permanent": true },
    { "source": "/faq",        "destination": "/en/faq",        "permanent": true },
    { "source": "/tour",       "destination": "/en/tour",       "permanent": true },
    { "source": "/advertise",  "destination": "/en/advertise",  "permanent": true }
  ],
  "functions": {
    "api/refresh-businesses.js": {
      "maxDuration": 60
    }
  },
  "crons": [
    {
      "path": "/api/refresh-businesses",
      "schedule": "0 10 * * *"
    }
  ]
}
```

- [ ] **Step 2: Sanity-parse the JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json'))" && echo ok
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat: schedule daily cron for businesses snapshot refresh"
```

---

## Task 6: Push, deploy, configure env vars, manually trigger to verify

This is the deployment + manual configuration step.

- [ ] **Step 1: Push the branch**

```bash
git status
git log --oneline -8
git push -u origin feat/pr4b-cron-automation
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --base main --head feat/pr4b-cron-automation --repo ninjackster/sjdg-community-site \
  --title "feat: PR 4b — automated nightly businesses snapshot refresh via Vercel cron + Upstash" \
  --body "$(cat <<'EOF'
## Summary

Second half of PR 4. Automates the businesses snapshot refresh that PR 4a did manually.

- Refactor: Places API fetch logic moved to \`scripts/lib/places-fetch.js\` (shared by CLI and serverless function)
- New \`api/refresh-businesses.js\` serverless function:
  - Auth-checks bearer token (Vercel Cron auto-injects \`CRON_SECRET\`)
  - Fetches all businesses from Places API
  - Writes snapshot JSON to Upstash Redis
  - POSTs to Vercel Deploy Hook → triggers rebuild → next build serves fresh data
- \`scripts/build.js\` now reads from Upstash first, falls back to committed JSON if Upstash is unreachable or empty
- \`vercel.json\` adds daily cron: \`0 10 * * *\` (10 UTC = 4 AM Mexico)
- Tests: 61 passing (50 prior + 5 places-fetch + 6 snapshot-store)

## REQUIRED Vercel dashboard configuration before merge

The cron will fail without these env vars (Vercel → Project Settings → Environment Variables):

| Var | Value |
|-----|-------|
| \`GOOGLE_PLACES_API_KEY\` | \`AIzaSyANDAxggsq6pL3Jdgav2PxIk4KvoQmu8m4\` (or new server-restricted key) |
| \`UPSTASH_REDIS_REST_URL\` | (likely already set — check) |
| \`UPSTASH_REDIS_REST_TOKEN\` | (likely already set — check) |
| \`VERCEL_DEPLOY_HOOK_URL\` | Create at Settings → Git → Deploy Hooks → name "Cron Refresh", branch \`main\`, copy URL |
| \`CRON_SECRET\` | \`openssl rand -hex 32\` — Vercel auto-passes this as Authorization for cron requests |

## Test plan

Post-merge, manually trigger the function to verify before waiting 24h for cron:

\`\`\`bash
curl -X POST https://sanjosedegracia.net/api/refresh-businesses \\
  -H "Authorization: Bearer <CRON_SECRET>"
\`\`\`

Expected response:
\`\`\`json
{ "ok": true, "count": 79, "fetchedAt": "2026-...", "deploy": { "ok": true, "status": 201 } }
\`\`\`

Then wait ~30s for the deploy hook to rebuild and verify a per-business page still serves correctly.

## Rollback plan

If cron misbehaves: remove the \`crons\` block from \`vercel.json\` and redeploy. The function endpoint stays but won't auto-fire. Build still works via Upstash → fallback chain.

## Out of scope (later PRs)

- Topic / tourist landing pages (PR 5)
- Search Console Domain property + .org redirect (PR 6)
- Photo downloads (backlog)
EOF
)"
```

- [ ] **Step 3: Wait for Vercel build success**

```bash
sleep 60
gh pr checks 5 --repo ninjackster/sjdg-community-site
```

- [ ] **Step 4: Configure env vars (controller does this via Chrome MCP or hands off to user)**

Vercel dashboard → Project `sjdg-webpage` → Settings → Environment Variables. Add the 5 vars listed in the PR description. Critical ones:
- `CRON_SECRET` — generate with `openssl rand -hex 32`
- `VERCEL_DEPLOY_HOOK_URL` — create at Settings → Git → Deploy Hooks (name "Cron Refresh", branch `main`)

Save after adding all 5. Verify by checking Settings → Environment Variables shows them all.

- [ ] **Step 5: Squash-merge the PR**

```bash
cd /tmp
gh pr merge 5 --squash --delete-branch --repo ninjackster/sjdg-community-site \
  --subject "feat: PR 4b — automated nightly businesses snapshot refresh via Vercel cron + Upstash"
```

- [ ] **Step 6: Wait for production deploy**

```bash
until /usr/bin/curl -s -o /dev/null -w "%{http_code}\n" https://sanjosedegracia.net/api/refresh-businesses | grep -qE "401|405|200"; do sleep 5; done
echo "function deployed"
```

(Without auth header, the function returns 401 — that's "alive and rejecting unauthorized" which is what we want.)

- [ ] **Step 7: Manually trigger the function to verify end-to-end**

```bash
SECRET="<paste CRON_SECRET value>"
curl -X POST https://sanjosedegracia.net/api/refresh-businesses \
  -H "Authorization: Bearer $SECRET" \
  -w "\n\nHTTP %{http_code}\n"
```

Expected:
```json
{ "ok": true, "count": 79, "fetchedAt": "2026-...", "deploy": { "ok": true, "status": 201 } }

HTTP 200
```

- [ ] **Step 8: Wait ~60s for the triggered redeploy, then verify a per-business page**

```bash
sleep 90
SLUG=bramido-san-jose-krfi1a
curl -s "https://sanjosedegracia.net/en/businesses/$SLUG" | grep -E '<title|"@type": "LocalBusiness"' | head -2
```

Expected: still shows BRAMIDO San José + LocalBusiness JSON-LD. The build re-ran and pulled fresh data from Upstash.

- [ ] **Step 9: Verify cron is registered**

In Vercel dashboard: Project → Settings → Crons. Should show:
```
/api/refresh-businesses    0 10 * * *    Active
```

- [ ] **Step 10: Cleanup worktree**

```bash
cd "/Users/jaimemurillo/Library/Mobile Documents/com~apple~CloudDocs/Projects/web/sjdg-webpage"
git worktree remove .worktrees/pr4b-cron-automation
git branch -D feat/pr4b-cron-automation
git fetch origin main && git reset --hard origin/main
```

---

## Self-Review Checklist (controller runs before handoff)

- [ ] **Spec coverage:** PR 4 / Option Y is now fully delivered (PR 4a static pages + PR 4b cron automation).
- [ ] **No placeholders:** No "TBD" / vague handwave steps.
- [ ] **Type consistency:** `getSnapshot`, `putSnapshot`, `fetchAllBusinesses`, `buildSnapshot`, `resolveSnapshot` — names consistent.
- [ ] **TDD where applicable:** Tasks 1, 2 have failing-tests-first.
- [ ] **Each task ends with a commit.**
- [ ] **No regression:** Build still produces 158 per-business pages (now via Upstash → local fallback chain).
- [ ] **Manual config explicitly documented in PR description and Task 4.**

## What ships in PR 4b

- Nightly automatic snapshot refresh (no manual `npm run fetch-businesses` needed)
- Upstash-backed snapshot with local JSON as durable fallback
- Refactored Places API logic shared between CLI and serverless function
- 61 tests passing

## Risks & mitigations

- **Cron fails silently:** Vercel logs surface in dashboard; check Settings → Crons → click recent invocation for logs. Failures don't break the site (last good snapshot persists in Upstash + local).
- **Upstash quota:** Snapshot is ~200KB per write; one write/day is well within free tier.
- **Places API quota:** Same cost as PR 4a — ~$0.50/month at daily refresh.
- **Function timeout:** Set to 60s in `vercel.json`. Places API calls usually complete in 5-15s for 12 categories.
- **Secret leakage:** `CRON_SECRET` is required for any trigger. Don't paste it in PR descriptions or commit it.
