import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

test('base.html schema no longer asserts 1,980 m or "Founded in 1793"', async () => {
  const base = await readFile(join(ROOT, 'templates/layouts/base.html'), 'utf8');
  assert.doesNotMatch(base, /1,980\s*m/i);
  assert.doesNotMatch(base, /Founded in 1793/i);
});
