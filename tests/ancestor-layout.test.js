import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutAncestors } from '../scripts/lib/ancestor-layout.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

const realTree = () => JSON.parse(readFileSync(
  fileURLToPath(new URL('../content/family/tree.json', import.meta.url)), 'utf8'));

test('real tree: focal I1 positioned, parents/grandparents at expected gens', () => {
  const pos = layoutAncestors(realTree(), 'I1', { nodeW: 210, gap: 30 });
  assert.equal(pos.get('I1').gen, 0);
  assert.equal(pos.get('I2').gen, 1); // Héctor (dad)
  assert.equal(pos.get('I3').gen, 1); // Mercedes (mom)
  assert.equal(pos.get('I4').gen, 2); // José (paternal grandfather)
  assert.equal(pos.get('I7').gen, 2); // María del Refugio (maternal grandmother)
});

test('real tree: maternal side (Mom I3) left of focal, paternal side (Dad I2) right', () => {
  const pos = layoutAncestors(realTree(), 'I1', { nodeW: 210, gap: 30 });
  const fx = pos.get('I1').x;
  assert.ok(pos.get('I3').x < fx, 'mom left of focal');
  assert.ok(pos.get('I2').x > fx, 'dad right of focal');
  // maternal grandparents both left of focal, paternal both right
  assert.ok(pos.get('I6').x < fx && pos.get('I7').x < fx, 'maternal grandparents left');
  assert.ok(pos.get('I4').x > fx && pos.get('I5').x > fx, 'paternal grandparents right');
});

test('real tree: within each grandparent union, wife is left of husband', () => {
  const pos = layoutAncestors(realTree(), 'I1', { nodeW: 210, gap: 30 });
  assert.ok(pos.get('I5').x < pos.get('I4').x, 'Teresa (wife) left of José (husband)');
  assert.ok(pos.get('I7').x < pos.get('I6').x, 'Cuca (wife) left of Benjamín (husband)');
});

test('real tree: no two direct ancestors in a generation overlap', () => {
  const pos = layoutAncestors(realTree(), 'I1', { nodeW: 210, gap: 30 });
  const byGen = {};
  for (const [, v] of pos) (byGen[v.gen] = byGen[v.gen] || []).push(v.x);
  for (const g of Object.keys(byGen)) {
    const xs = byGen[g].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i-1] >= 210 - 1e-6, `gen ${g} overlap`);
  }
});

// ---- collateral siblings (aunts/uncles) ----
const indC = (id, sex) => ({ id, names: { given: id, surnames: [] }, sex });
// focal F; parents M(wife,F)+D(husband,M); M has sister MS; D has brother DS; MS married to MSP.
const withCollaterals = () => ({
  individuals: [
    indC('F','M'), indC('M','F'), indC('D','M'),
    indC('MM','F'), indC('MD','M'), indC('DM','F'), indC('DD','M'),
    indC('MS','F'), indC('DS','M'), indC('MSP','M'),
  ],
  families: [
    { id: 'f1', husband: 'D', wife: 'M', children: ['F'] },
    { id: 'f2', husband: 'DD', wife: 'DM', children: ['D', 'DS'] },
    { id: 'f3', husband: 'MD', wife: 'MM', children: ['M', 'MS'] },
    { id: 'f4', husband: 'MSP', wife: 'MS', children: [] },
  ],
});

test('collaterals: maternal aunt fans left of mom, paternal uncle fans right of dad', () => {
  const pos = layoutAncestors(withCollaterals(), 'F', { nodeW: 100, gap: 20 });
  assert.ok(pos.get('MS').x < pos.get('M').x, 'maternal aunt left of mom');
  assert.ok(pos.get('DS').x > pos.get('D').x, 'paternal uncle right of dad');
});

test('collaterals: every maternal-side node left of focal, every paternal-side node right', () => {
  const pos = layoutAncestors(withCollaterals(), 'F', { nodeW: 100, gap: 20 });
  const fx = pos.get('F').x;
  for (const id of ['M', 'MS', 'MM', 'MD', 'MSP']) assert.ok(pos.get(id).x < fx, `${id} should be left of focal`);
  for (const id of ['D', 'DS', 'DM', 'DD']) assert.ok(pos.get(id).x > fx, `${id} should be right of focal`);
});

test('collaterals: married-in spouse placed adjacent, wife left of husband', () => {
  const pos = layoutAncestors(withCollaterals(), 'F', { nodeW: 100, gap: 20 });
  // MS (wife) should be left of her husband MSP
  assert.ok(pos.get('MS').x < pos.get('MSP').x, 'aunt (wife) left of her husband');
  assert.ok(Math.abs((pos.get('MSP').x - pos.get('MS').x)) <= 100 + 20 + 1e-6, 'spouse adjacent within a slot');
});

test('collaterals: no overlap within any generation', () => {
  const pos = layoutAncestors(withCollaterals(), 'F', { nodeW: 100, gap: 20 });
  const byGen = {};
  for (const [, v] of pos) (byGen[v.gen] = byGen[v.gen] || []).push(v.x);
  for (const g of Object.keys(byGen)) {
    const xs = byGen[g].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i-1] >= 100 - 1e-6, `gen ${g} overlap`);
  }
});
