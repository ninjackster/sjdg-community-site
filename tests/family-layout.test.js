import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGenerations } from '../scripts/lib/family-layout.js';

const tree = {
  individuals: [{ id: 'I1' }, { id: 'I2' }, { id: 'I3' }, { id: 'I4' }, { id: 'I5' }],
  families: [
    { id: 'F1', husband: 'I2', wife: 'I3', children: ['I1'] },
    { id: 'F2', husband: 'I4', wife: 'I5', children: ['I2'] },
  ],
};

test('root (no parents) is generation 0', () => {
  const gens = computeGenerations(tree, 'I1');
  assert.equal(gens.get('I1'), 0);
});

test('parents are generation 1, grandparents generation 2', () => {
  const gens = computeGenerations(tree, 'I1');
  assert.equal(gens.get('I2'), 1);
  assert.equal(gens.get('I3'), 1);
  assert.equal(gens.get('I4'), 2);
  assert.equal(gens.get('I5'), 2);
});
