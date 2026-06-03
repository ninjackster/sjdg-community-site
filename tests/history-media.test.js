import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVoces, validateFotos } from '../scripts/lib/history-media.js';

test('validateVoces: ok, dup id, bad kind, non-bilingual transcript', () => {
  const v = (o = {}) => ({ id: 'v1', kind: 'file', audioSrc: '/a.mp3', transcript: { en: 'x', es: 'y' }, ...o });
  assert.equal(validateVoces({ items: [v(), v({ id: 'v2', kind: 'embed' })] }).valid, true);
  assert.equal(validateVoces({ items: [v(), v()] }).valid, false);
  assert.equal(validateVoces({ items: [v({ kind: 'nope' })] }).valid, false);
  assert.equal(validateVoces({ items: [v({ transcript: { en: 'x' } })] }).valid, false);
  assert.equal(validateVoces({ items: [] }).valid, true);
});

test('validateFotos: ok, dup id, missing src, non-bilingual caption', () => {
  const p = (o = {}) => ({ id: 'p1', then: { src: '/t.jpg', caption: { en: 'a', es: 'b' } }, now: { src: '/n.jpg', caption: { en: 'a', es: 'b' } }, ...o });
  assert.equal(validateFotos({ pairs: [p(), p({ id: 'p2' })] }).valid, true);
  assert.equal(validateFotos({ pairs: [p(), p()] }).valid, false);
  assert.equal(validateFotos({ pairs: [p({ then: { src: '', caption: { en: 'a', es: 'b' } } })] }).valid, false);
  assert.equal(validateFotos({ pairs: [] }).valid, true);
});
