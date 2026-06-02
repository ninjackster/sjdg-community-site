import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutAncestors } from '../scripts/lib/ancestor-layout.js';

// Synthetic tree: focal F with parents (mom M, dad D); each grandparent known.
//   F1: husband=D, wife=M, children=[F]
//   F2 (dad's parents): husband=DD, wife=DM, children=[D]
//   F3 (mom's parents): husband=MD, wife=MM, children=[M]
const ind = (id, sex) => ({ id, names: { given: id, surnames: [] }, sex });
const synthetic = () => ({
  individuals: ['F','M','D','MM','MD','DM','DD'].map(id => ind(id, /M$|^M$|^MM$|^DM$/.test(id) ? 'F' : 'M')),
  families: [
    { id: 'f1', husband: 'D', wife: 'M', children: ['F'] },
    { id: 'f2', husband: 'DD', wife: 'DM', children: ['D'] },
    { id: 'f3', husband: 'MD', wife: 'MM', children: ['M'] },
  ],
});

const NODE = 100, GAP = 20, OPTS = { nodeW: NODE, gap: GAP };
// helper: max x over a set of ids, min x over a set
const maxX = (pos, ids) => Math.max(...ids.map(i => pos.get(i).x));
const minX = (pos, ids) => Math.min(...ids.map(i => pos.get(i).x));

test('focal at gen 0, parents gen 1, grandparents gen 2', () => {
  const pos = layoutAncestors(synthetic(), 'F', OPTS);
  assert.equal(pos.get('F').gen, 0);
  assert.equal(pos.get('M').gen, 1);
  assert.equal(pos.get('D').gen, 1);
  assert.equal(pos.get('MM').gen, 2);
  assert.equal(pos.get('DD').gen, 2);
});

test('bifurcation: wife (maternal) lineage entirely left of husband (paternal) lineage', () => {
  const pos = layoutAncestors(synthetic(), 'F', OPTS);
  const maternal = ['M', 'MM', 'MD'];
  const paternal = ['D', 'DM', 'DD'];
  assert.ok(maxX(pos, maternal) < minX(pos, paternal),
    `maternal max ${maxX(pos, maternal)} should be < paternal min ${minX(pos, paternal)}`);
});

test('global partition: maternal < focal < paternal', () => {
  const pos = layoutAncestors(synthetic(), 'F', OPTS);
  const fx = pos.get('F').x;
  assert.ok(maxX(pos, ['M','MM','MD']) < fx);
  assert.ok(fx < minX(pos, ['D','DM','DD']));
});

test('per-union bifurcation: within dad union, his wife-mother (DM) left of his husband-father (DD)', () => {
  const pos = layoutAncestors(synthetic(), 'F', OPTS);
  assert.ok(pos.get('DM').x < pos.get('DD').x);
  assert.ok(pos.get('MM').x < pos.get('MD').x);
});

test('parent centering: focal is at midpoint of its two parents', () => {
  const pos = layoutAncestors(synthetic(), 'F', OPTS);
  const mid = (pos.get('M').x + pos.get('D').x) / 2;
  assert.ok(Math.abs(pos.get('F').x - mid) < 1e-6);
});

test('no overlap: nodes in the same generation are >= nodeW apart', () => {
  const pos = layoutAncestors(synthetic(), 'F', OPTS);
  const byGen = {};
  for (const [, v] of pos) (byGen[v.gen] = byGen[v.gen] || []).push(v.x);
  for (const g of Object.keys(byGen)) {
    const xs = byGen[g].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i-1] >= NODE - 1e-6, `gen ${g} overlap`);
  }
});

const ind2 = (id, sex) => ({ id, names: { given: id, surnames: [] }, sex });

test('single known parent: child centers under that parent', () => {
  const tree = {
    individuals: [ind2('F','M'), ind2('M','F')],
    families: [{ id: 'f1', husband: null, wife: 'M', children: ['F'] }],
  };
  const pos = layoutAncestors(tree, 'F', { nodeW: 100, gap: 20 });
  assert.equal(pos.get('M').gen, 1);
  assert.ok(Math.abs(pos.get('F').x - pos.get('M').x) < 1e-6);
});

test('placeholder ancestors are positioned like normal leaves', () => {
  const tree = {
    individuals: [
      ind2('F','M'), ind2('M','F'), ind2('D','M'),
      { id: 'MM', names: { given: '¿?', surnames: [] }, placeholder: true },
    ],
    families: [
      { id: 'f1', husband: 'D', wife: 'M', children: ['F'] },
      { id: 'f3', husband: null, wife: 'MM', children: ['M'] },
    ],
  };
  const pos = layoutAncestors(tree, 'F', { nodeW: 100, gap: 20 });
  assert.equal(pos.get('MM').gen, 2);
  assert.ok(pos.get('MM').x < pos.get('D').x); // maternal placeholder still on the left
});

test('missing focal family: returns focal only at x=0 gen 0, no throw', () => {
  const tree = { individuals: [ind2('F','M')], families: [] };
  const pos = layoutAncestors(tree, 'F', { nodeW: 100, gap: 20 });
  assert.equal(pos.size, 1);
  assert.deepEqual(pos.get('F'), { x: 0, gen: 0 });
});

test('hidden ancestor (isHidden) is omitted and does not break centering', () => {
  const tree = {
    individuals: [ind2('F','M'), ind2('M','F'), ind2('D','M'), ind2('DD','M'), ind2('DM','F')],
    families: [
      { id: 'f1', husband: 'D', wife: 'M', children: ['F'] },
      { id: 'f2', husband: 'DD', wife: 'DM', children: ['D'] },
    ],
  };
  const pos = layoutAncestors(tree, 'F', { nodeW: 100, gap: 20, isHidden: (id) => id === 'DM' });
  assert.ok(!pos.has('DM'));
  assert.ok(pos.has('DD'));
  assert.ok(Math.abs(pos.get('D').x - pos.get('DD').x) < 1e-6); // D centers under lone DD
});
