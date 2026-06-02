import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, surnameColor } from '../family-stats.js';

const ind = (id, given, surnames, extra = {}) => ({ id, names: { given, surnames }, ...extra });
const tree = () => ({
  individuals: [
    ind('I1', 'Jaime', ['Murillo', 'Mena']),
    ind('I2', 'Héctor', ['Murillo', 'Patiño'], { death: { date: null } }),
    ind('I3', 'Mercedes', ['Mena', 'Ruiz']),
    ind('I4', 'José', ['Murillo', 'Villalobos'], { birth: { date: '1930' }, death: { date: '2010' } }),
    ind('I5', 'Teresa', ['Patiño', 'Gutiérrez'], { death: { date: 'c. 1999' } }),
    ind('I9', '¿?', ['Murillo'], { placeholder: true }),
    ind('I10', 'Ana', ['Ruiz'], { photo: '/family-photos/I10.jpg' }),
  ],
  families: [
    { id: 'F1', husband: 'I2', wife: 'I3', children: ['I1'] },
    { id: 'F2', husband: 'I4', wife: 'I5', children: ['I2', 'I9', 'I10'] },
  ],
});

test('counts: total, placeholders, photos, deceased/living', () => {
  const s = computeStats(tree());
  assert.equal(s.total, 7);
  assert.equal(s.placeholders, 1);
  assert.equal(s.withPhotos, 1);
  assert.equal(s.deceased, 2);        // I4 (2010), I5 (c.1999) have death dates
  assert.equal(s.living, 5);
});

test('top surnames ranked by frequency', () => {
  const s = computeStats(tree());
  // Murillo appears as a primary/!-secondary surname on I1,I2,I4,I9 = 4
  const murillo = s.topSurnames.find(x => x.surname === 'Murillo');
  assert.ok(murillo && murillo.count >= 3);
  assert.ok(s.topSurnames[0].count >= s.topSurnames[s.topSurnames.length - 1].count);
});

test('largest family by children count', () => {
  const s = computeStats(tree());
  assert.equal(s.largestFamily.count, 3); // F2 has 3 children
});

test('average lifespan from parseable birth+death years', () => {
  const s = computeStats(tree());
  // only I4 has both (1930-2010 = 80); average over those = 80
  assert.equal(s.avgLifespan, 80);
});

test('handles empty tree without throwing', () => {
  const s = computeStats({ individuals: [], families: [] });
  assert.equal(s.total, 0);
  assert.equal(s.avgLifespan, null);
  assert.deepEqual(s.topSurnames, []);
});

test('surnameColor is deterministic and returns a hex', () => {
  const a = surnameColor('Murillo'), b = surnameColor('Murillo'), c = surnameColor('Mena');
  assert.equal(a, b);
  assert.match(a, /^#[0-9a-fA-F]{6}$/);
  assert.notEqual(a, c);
});
