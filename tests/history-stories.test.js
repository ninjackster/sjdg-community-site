import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStories } from '../scripts/lib/history-stories.js';

const story = (over = {}) => ({
  id: 's1', kind: 'event',
  title: { en: 'T', es: 'T' }, body: { en: 'B', es: 'B' }, ...over,
});

test('valid set passes', () => {
  const r = validateStories({ stories: [story(), story({ id: 's2' })] });
  assert.equal(r.valid, true);
});
test('duplicate id fails', () => {
  const r = validateStories({ stories: [story(), story()] });
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /duplicate id/i);
});
test('missing bilingual field fails', () => {
  const r = validateStories({ stories: [story({ title: { en: 'only' } })] });
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /title/);
});
test('bad kind fails', () => {
  const r = validateStories({ stories: [story({ kind: 'nope' })] });
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /kind/);
});
test('non-numeric place coords fail', () => {
  const r = validateStories({ stories: [story({ place: { name: 'X', lat: 'a', lng: 1 } })] });
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /coord/i);
});
