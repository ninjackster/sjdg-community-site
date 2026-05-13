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
    console.error('[snapshot-store] getSnapshot failed:', err.message);
    return null;
  }
}

export async function putSnapshot(snapshot, env = process.env, fetchFn = fetch) {
  if (!isConfigured(env)) return { skipped: true };
  const body = JSON.stringify(snapshot);
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
