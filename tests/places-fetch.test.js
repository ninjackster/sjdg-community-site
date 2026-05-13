import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlace, dedupeAndBlock } from '../scripts/lib/places-fetch.js';

test('normalizePlace strips "places/" prefix from id', () => {
  const raw = {
    id: 'places/ChIJabc123',
    displayName: { text: 'Test' },
    types: ['restaurant'],
  };
  const n = normalizePlace(raw);
  assert.equal(n.placeId, 'ChIJabc123');
  assert.equal(n.displayName, 'Test');
});

test('normalizePlace builds a slug from name + place_id', () => {
  const n = normalizePlace({
    id: 'places/ChIJabc123def',
    displayName: { text: 'Café Azul' },
  });
  assert.equal(n.slug, 'cafe-azul-123def');
});

test('normalizePlace handles missing fields gracefully', () => {
  const n = normalizePlace({ id: 'places/X' });
  assert.equal(n.placeId, 'X');
  assert.equal(n.displayName, '');
  assert.deepEqual(n.types, []);
});

test('dedupeAndBlock removes duplicates by placeId', () => {
  const list = [
    { placeId: 'A', displayName: 'one' },
    { placeId: 'B', displayName: 'two' },
    { placeId: 'A', displayName: 'one again' },
  ];
  const result = dedupeAndBlock(list, new Set());
  assert.equal(result.length, 2);
  assert.equal(result[0].displayName, 'one');
  assert.equal(result[1].displayName, 'two');
});

test('dedupeAndBlock removes blocked placeIds', () => {
  const list = [
    { placeId: 'A', displayName: 'keep' },
    { placeId: 'B', displayName: 'blocked' },
    { placeId: 'C', displayName: 'keep' },
  ];
  const result = dedupeAndBlock(list, new Set(['B']));
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(b => b.placeId), ['A', 'C']);
});
