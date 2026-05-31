import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyToken } from '../scripts/lib/family-cookie.js';

const PASSWORD = process.env.FAMILY_TREE_PASSWORD || 'changeme';
const SECRET   = process.env.FAMILY_TREE_SECRET   || PASSWORD;
const COOKIE   = 'ft_auth';
const __dirname = dirname(fileURLToPath(import.meta.url));

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
  const data = await readFile(join(__dirname, '../content/family/tree.json'), 'utf8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).send(data);
}
