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
