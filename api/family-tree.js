import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyToken } from '../scripts/lib/family-cookie.js';
import { applyApproved } from '../scripts/lib/family-merge.js';

const PASSWORD = process.env.FAMILY_TREE_PASSWORD || 'changeme';
const SECRET   = process.env.FAMILY_TREE_SECRET   || PASSWORD;
const COOKIE   = 'ft_auth';
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Fetch approved family submissions (best-effort; never block the tree on Redis).
async function approvedSubmissions() {
  if (!REDIS_URL || !REDIS_TOKEN) return [];
  try {
    const res = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(['HGETALL', 'fam_subs']) });
    const j = await res.json();
    const flat = j.result || [];
    const out = [];
    for (let i = 0; i < flat.length; i += 2) { try { const s = JSON.parse(flat[i + 1]); if (s && s.status === 'approved') out.push(s); } catch (_) { /* skip */ } }
    return out;
  } catch (_) { return []; }
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const token = readCookie(req, COOKIE);
  if (!verifyToken({ token, secret: SECRET, nowMs: Date.now() })) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const raw = await readFile(join(__dirname, '../content/family/tree.json'), 'utf8');
  let tree = JSON.parse(raw);
  const approved = await approvedSubmissions();
  if (approved.length) tree = applyApproved(tree, approved);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(tree);
}
