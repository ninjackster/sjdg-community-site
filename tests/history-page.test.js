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

import { loadContent } from '../scripts/lib/content.js';

test('history content is corrected, bylined, and sourced', async () => {
  const c = await loadContent(join(ROOT, 'content/pages/history.json'));
  const json = JSON.stringify(c);
  // facts corrected
  assert.doesNotMatch(json, /Founded in 1793|Fundado en 1793|1,980/);
  assert.match(json, /1,907|1,900/);
  // byline present (both langs)
  assert.match(c.byline.en, /Compilado por Jaime Murillo/);
  assert.match(c.byline.es, /Compilado por Jaime Murillo/);
  // all 9 narrative sections present
  for (const k of ['place','origins','administrative','faith','cristero','economy','people','culture','book1897']) {
    assert.ok(c.sections[k] && c.sections[k].h2 && c.sections[k].body, `missing section ${k}`);
  }
  // sources block present with at least 4 items rendered as HTML list
  assert.match(c.sources.body.en, /<li/);
  assert.ok((c.sources.body.en.match(/<li/g) || []).length >= 4);
  // pdf button label present
  assert.ok(c.pdf.label.en && c.pdf.label.es);
});
