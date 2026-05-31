import { createHmac, timingSafeEqual } from 'node:crypto';

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

// token = "<expiresAtMs>.<hmac>"
export function signToken({ secret, ttlMs, nowMs }) {
  const expiresAt = nowMs + ttlMs;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyToken({ token, secret, nowMs }) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const idx = token.lastIndexOf('.');
  const payload = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  const expected = sign(payload, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && nowMs < expiresAt;
}
