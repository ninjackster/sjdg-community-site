import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signToken, verifyToken } from '../scripts/lib/family-cookie.js';

const SECRET = 'test-secret';

test('a freshly signed token verifies', () => {
  const t = signToken({ secret: SECRET, ttlMs: 60000, nowMs: 1000 });
  assert.equal(verifyToken({ token: t, secret: SECRET, nowMs: 2000 }), true);
});

test('a tampered token fails verification', () => {
  const t = signToken({ secret: SECRET, ttlMs: 60000, nowMs: 1000 });
  assert.equal(verifyToken({ token: t + 'x', secret: SECRET, nowMs: 2000 }), false);
});

test('a token signed with a different secret fails', () => {
  const t = signToken({ secret: 'other', ttlMs: 60000, nowMs: 1000 });
  assert.equal(verifyToken({ token: t, secret: SECRET, nowMs: 2000 }), false);
});

test('an expired token fails', () => {
  const t = signToken({ secret: SECRET, ttlMs: 1000, nowMs: 1000 });
  assert.equal(verifyToken({ token: t, secret: SECRET, nowMs: 5000 }), false);
});
