import { signToken } from '../scripts/lib/family-cookie.js';

const PASSWORD = process.env.FAMILY_TREE_PASSWORD || 'changeme';
const SECRET   = process.env.FAMILY_TREE_SECRET   || PASSWORD;
const TTL_MS   = 1000 * 60 * 60 * 24 * 30; // 30 days
const COOKIE   = 'ft_auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { password } = req.body || {};
  if (typeof password !== 'string' || password !== PASSWORD) {
    return res.status(401).json({ ok: false });
  }
  const token = signToken({ secret: SECRET, ttlMs: TTL_MS, nowMs: Date.now() });
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL_MS / 1000}`);
  return res.json({ ok: true });
}
