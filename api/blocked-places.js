const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'Jaime201!';
const REDIS_KEY   = 'blocked_places';

async function redis(cmd, ...args) {
  const res = await fetch(`${REDIS_URL}/${cmd}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

function authorized(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return token === ADMIN_PASS;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const raw = await redis('smembers', REDIS_KEY);
      return res.json({ blocked: Array.isArray(raw) ? raw : [] });
    }

    if (!authorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { place_id } = req.body || {};
    if (!place_id || typeof place_id !== 'string') {
      return res.status(400).json({ error: 'place_id required' });
    }

    if (req.method === 'POST') {
      await redis('sadd', REDIS_KEY, place_id);
      return res.json({ ok: true, action: 'blocked', place_id });
    }

    if (req.method === 'DELETE') {
      await redis('srem', REDIS_KEY, place_id);
      return res.json({ ok: true, action: 'unblocked', place_id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
