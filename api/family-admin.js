const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Jaime201!';
const HASH = 'fam_subs';

async function redis(cmd) {
  const res = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
function authorized(req) {
  const auth = req.headers['authorization'] || '';
  return (auth.startsWith('Bearer ') ? auth.slice(7) : '') === ADMIN_PASS;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: 'Storage not configured' });

  if (req.method === 'GET') {
    const flat = await redis(['HGETALL', HASH]) || [];
    const subs = [];
    for (let i = 0; i < flat.length; i += 2) { try { subs.push(JSON.parse(flat[i + 1])); } catch (_) { /* skip */ } }
    subs.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return res.json({ submissions: subs });
  }

  if (req.method === 'POST') {
    const { id, action } = req.body || {};
    if (!id || !['approve', 'reject', 'delete'].includes(action)) return res.status(400).json({ error: 'id and action required' });
    if (action === 'reject' || action === 'delete') { await redis(['HDEL', HASH, id]); return res.json({ ok: true, action }); }
    const raw = await redis(['HGET', HASH, id]);
    if (!raw) return res.status(404).json({ error: 'not found' });
    const sub = JSON.parse(raw); sub.status = 'approved';
    await redis(['HSET', HASH, id, JSON.stringify(sub)]);
    return res.json({ ok: true, action: 'approve' });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
