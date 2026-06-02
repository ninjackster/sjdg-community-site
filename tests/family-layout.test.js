import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel } from '../family-layout.js';

const ind = (id, sex) => ({ id, names: { given: id, surnames: [] }, sex });
const synthetic = () => ({
  individuals: ['F','M','D','MM','MD','DM','DD'].map(id => ind(id, /M$|^M$/.test(id) ? 'F' : 'M')),
  families: [
    { id: 'f1', husband: 'D', wife: 'M', children: ['F'] },
    { id: 'f2', husband: 'DD', wife: 'DM', children: ['D'] },
    { id: 'f3', husband: 'MD', wife: 'MM', children: ['M'] },
  ],
});

test('buildModel: focal gen 0, parents gen 1, grandparents gen 2; sides M/P', () => {
  const m = buildModel(synthetic(), 'F');
  assert.equal(m.gen.get('F'), 0);
  assert.equal(m.gen.get('M'), 1);
  assert.equal(m.gen.get('D'), 1);
  assert.equal(m.gen.get('MM'), 2);
  assert.equal(m.sideOf('M'), 'M');
  assert.equal(m.sideOf('D'), 'P');
  assert.equal(m.sideOf('F'), 'C');
});

test('buildModel: coupleOf and childParents are bidirectional/complete', () => {
  const m = buildModel(synthetic(), 'F');
  assert.equal(m.coupleOf.get('M'), 'D');
  assert.equal(m.coupleOf.get('D'), 'M');
  assert.deepEqual([...(m.childParents.get('F') || [])].sort(), ['D','M']);
});
