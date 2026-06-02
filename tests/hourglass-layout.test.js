import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel } from '../hourglass-layout.js';
import { layoutSubtree } from '../hourglass-layout.js';

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

// A grandparent G with two children C1, C2; C1 has two kids K1,K2.
const descTree = () => ({
  individuals: ['G','C1','C2','K1','K2'].map(id => ind(id, 'M')),
  families: [
    { id: 'g', husband: 'G', wife: null, children: ['C1','C2'] },
    { id: 'c1', husband: 'C1', wife: null, children: ['K1','K2'] },
  ],
});

test('layoutSubtree: parent centred over its children span, no overlap', () => {
  const m = buildModel(descTree(), 'G');
  const { cells, w } = layoutSubtree('G', 0, m, { nodeW: 100, gap: 20, vis: () => true });
  const pos = new Map(cells.map(c => [c.id, c]));
  // K1,K2 are gen -2 leaves under C1; C1 centred over them; G centred over C1,C2 span.
  const c1mid = (pos.get('K1').x + pos.get('K2').x) / 2;
  assert.ok(Math.abs(pos.get('C1').x - c1mid) < 1e-6, 'C1 centred over its kids');
  // total width spans 3 leaf columns (K1,K2,C2) => 3*100 + 2*20
  assert.equal(w, 3 * 100 + 2 * 20);
  // no two cells in the same gen overlap
  const byGen = {}; for (const c of cells) (byGen[c.gen] = byGen[c.gen] || []).push(c.x);
  for (const g of Object.keys(byGen)) { const xs = byGen[g].sort((a,b)=>a-b); for (let i=1;i<xs.length;i++) assert.ok(xs[i]-xs[i-1] >= 100 - 1e-6); }
});
