import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

test('client inlines the ancestor-layout recursion body verbatim', () => {
  const mod = read('../scripts/lib/ancestor-layout.js');
  const client = read('../family-tree.js');
  // The distinctive recursion line must appear in both, proving the client carries the same algorithm.
  const marker = "const fanLeft = (byId.get(spineId) || {}).sex === 'F';";
  assert.ok(mod.includes(marker), 'module missing recursion marker');
  assert.ok(client.includes(marker), 'client missing inlined recursion marker — re-sync from scripts/lib/ancestor-layout.js');
});
