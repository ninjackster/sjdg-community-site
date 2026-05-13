import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { getSnapshot, putSnapshot } from '../scripts/lib/snapshot-store.js';

test('getSnapshot returns null when env vars missing', async () => {
  const result = await getSnapshot({});
  assert.equal(result, null);
});

test('putSnapshot is a no-op when env vars missing', async () => {
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
