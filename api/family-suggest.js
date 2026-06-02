import { verifyToken } from '../scripts/lib/family-cookie.js';
import { buildEditSubmission } from '../scripts/lib/family-subs.js';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const PASSWORD = process.env.FAMILY_TREE_PASSWORD || 'changeme';
const SECRET = process.env.FAMILY_TREE_SECRET || PASSWORD;
const COOKIE = 'ft_auth';
const HASH = 'fam_subs';
const RELS = new Set(['child', 'parent', 'spouse', 'sibling']);

async function redis(cmd) {
  const res = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function cookieVal(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) { const [k, ...v] = part.trim().split('='); if (k === name) return v.join('='); }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  // Only logged-in family (valid auth cookie) may submit.
  if (!verifyToken({ token: cookieVal(req, COOKIE), secret: SECRET, nowMs: Date.now() })) return res.status(401).json({ error: 'Unauthorized' });
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: 'Storage not configured' });

  const b = req.body || {};

  // Suggest-a-correction (edit to an existing person) — same review queue, tagged kind:'edit'.
  if (b.kind === 'edit') {
    const eid = 'X' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    const { sub, error } = buildEditSubmission(b, eid, Date.now());
    if (error) return res.status(400).json({ error });
    await redis(['HSET', HASH, sub.id, JSON.stringify(sub)]);
    return res.json({ ok: true });
  }

  const given = typeof b.given === 'string' ? b.given.trim().slice(0, 60) : '';
  if (!given) return res.status(400).json({ error: 'name required' });
  if (!b.relativeOf || typeof b.relativeOf !== 'string') return res.status(400).json({ error: 'relativeOf required' });
  if (!RELS.has(b.relationship)) return res.status(400).json({ error: 'invalid relationship' });
  const surnames = Array.isArray(b.surnames) ? b.surnames.map(s => String(s).trim().slice(0, 40)).filter(Boolean).slice(0, 3) : (typeof b.surnames === 'string' ? b.surnames.trim().split(/\s+/).slice(0, 3) : []);
  const photo = (typeof b.photo === 'string' && b.photo.startsWith('data:image/') && b.photo.length < 220000) ? b.photo : null;
  const note = typeof b.note === 'string' ? b.note.slice(0, 600) : '';
  const id = 'X' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const sub = {
    id, status: 'pending', relativeOf: b.relativeOf, relationship: b.relationship,
    names: { given, surnames }, sex: (b.sex === 'M' || b.sex === 'F') ? b.sex : null,
    birth: { date: (typeof b.birth === 'string' && b.birth.trim()) ? b.birth.trim().slice(0, 40) : null, place: null },
    death: { date: (typeof b.death === 'string' && b.death.trim()) ? b.death.trim().slice(0, 40) : null, place: null },
    photo, notes: { en: note, es: note }, ts: Date.now(),
  };
  await redis(['HSET', HASH, id, JSON.stringify(sub)]);
  return res.json({ ok: true });
}
