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

test('siblings of the root render at the root generation', () => {
  const t = {
    individuals: [{ id: 'I1' }, { id: 'I1b' }, { id: 'I2' }, { id: 'I3' }],
    families: [{ id: 'F1', husband: 'I2', wife: 'I3', children: ['I1', 'I1b'] }],
  };
  const gens = computeGenerations(t, 'I1');
  assert.equal(gens.get('I1'), 0);
  assert.equal(gens.get('I1b'), 0); // sibling placed at root's generation
  assert.equal(gens.get('I2'), 1);
});

test('a grandparent\'s siblings render even when their parents are not in the tree', () => {
  // I4 is a placed grandparent (gen 2). His siblings I4b/I4c share his family
  // of origin F8, whose parents are unknown (null). They should still be seated
  // at gen 2 via the placed-sibling rule.
  const t = {
    individuals: [{ id: 'I1' }, { id: 'I2' }, { id: 'I3' }, { id: 'I4' }, { id: 'I5' }, { id: 'I4b' }, { id: 'I4c' }],
    families: [
      { id: 'F1', husband: 'I2', wife: 'I3', children: ['I1'] },
      { id: 'F2', husband: 'I4', wife: 'I5', children: ['I2'] },
      { id: 'F8', husband: null, wife: null, children: ['I4', 'I4b', 'I4c'] },
    ],
  };
  const gens = computeGenerations(t, 'I1');
  assert.equal(gens.get('I4'), 2);
  assert.equal(gens.get('I4b'), 2);
  assert.equal(gens.get('I4c'), 2);
});

test('uncles/aunts (parent\'s siblings) render at the parent generation', () => {
  const t = {
    individuals: [{ id: 'I1' }, { id: 'I2' }, { id: 'I2b' }, { id: 'I3' }, { id: 'I4' }, { id: 'I5' }],
    families: [
      { id: 'F1', husband: 'I2', wife: 'I3', children: ['I1'] },
      { id: 'F2', husband: 'I4', wife: 'I5', children: ['I2', 'I2b'] },
    ],
  };
  const gens = computeGenerations(t, 'I1');
  assert.equal(gens.get('I2'), 1);
  assert.equal(gens.get('I2b'), 1); // uncle/aunt at the parent's generation
  assert.equal(gens.get('I4'), 2);
});
